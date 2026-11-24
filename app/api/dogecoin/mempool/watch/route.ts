import {
  buildOnlyDogeMempoolWatchUrl,
  getOnlyDogeApiToken,
} from "@/lib/onlydoge";
import { isDogecoinP2pkhAddress } from "@/registry/default/dogecoin-payment-button/dogecoin";
import {
  MEMPOOL_WATCH_TIMEOUT_EVENT,
  isNonNegativeBaseUnits,
} from "@/registry/default/dogecoin-payment-button/mempool-watch";

export const dynamic = "force-dynamic";

/** Vercel's hard limit for this route. The stream closes gracefully before it. */
export const maxDuration = 300;

const MILLISECONDS_PER_SECOND = 1000;
const PROXY_WATCH_TIMEOUT_MARGIN_MS = 10_000;
const PROXY_WATCH_TIMEOUT_MS =
  maxDuration * MILLISECONDS_PER_SECOND - PROXY_WATCH_TIMEOUT_MARGIN_MS;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
  "X-Accel-Buffering": "no",
} as const;

const jsonError = (
  message: string,
  status: number,
  details?: Record<string, string>
): Response => Response.json({ error: message, ...details }, { status });

/**
 * Flatten nested `Error.cause` chains (common with undici `fetch` failures) into
 * a single readable string for logs and 502 responses.
 */
const describeFetchError = (error: unknown): string => {
  const parts: string[] = [];
  const seen = new Set<object>();
  let current: unknown = error;

  while (current !== undefined && current !== null) {
    if (typeof current === "string") {
      parts.push(current);
      break;
    }

    if (typeof current !== "object") {
      parts.push(String(current));
      break;
    }

    if (seen.has(current)) {
      break;
    }
    seen.add(current);

    if (current instanceof Error) {
      const name = current.name && current.name !== "Error" ? current.name : "";
      const message = current.message.trim();
      parts.push(name && message ? `${name}: ${message}` : message || name);

      const record = current as Error & {
        code?: unknown;
        errno?: unknown;
        syscall?: unknown;
        address?: unknown;
        port?: unknown;
      };
      const meta = [
        typeof record.code === "string" ? `code=${record.code}` : null,
        typeof record.errno === "number" ? `errno=${record.errno}` : null,
        typeof record.syscall === "string" ? `syscall=${record.syscall}` : null,
        typeof record.address === "string" ? `address=${record.address}` : null,
        typeof record.port === "number" ? `port=${record.port}` : null,
      ].filter((value): value is string => value !== null);

      if (meta.length > 0) {
        parts.push(meta.join(" "));
      }

      current = record.cause;
      continue;
    }

    try {
      parts.push(JSON.stringify(current));
    } catch {
      parts.push(Object.prototype.toString.call(current));
    }
    break;
  }

  return parts.filter((part) => part.length > 0).join(" | ") || "unknown error";
};

const timeoutEvent = (address: string): string => {
  const payload = JSON.stringify({
    address,
    expiresAt: new Date().toISOString(),
  });

  return `event: ${MEMPOOL_WATCH_TIMEOUT_EVENT}\ndata: ${payload}\n\n`;
};

// Forward complete SSE frames, so a proxy timeout cannot complete a partial
// upstream event with invalid JSON. Comments and heartbeat frames pass through.
const SSE_FRAME_BOUNDARY = /\r?\n\r?\n/gu;

const completeFrameEnd = (buffer: string): number => {
  let end = 0;
  for (const delimiter of buffer.matchAll(SSE_FRAME_BOUNDARY)) {
    end = delimiter.index + delimiter[0].length;
  }
  return end;
};

const proxyBody = (
  body: ReadableStream<Uint8Array>,
  address: string,
  upstreamController: AbortController,
  timeoutReason: DOMException,
  cleanup: () => void
): ReadableStream<Uint8Array> => {
  const reader = body.getReader();
  const { signal } = upstreamController;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  let onAbort: () => void;

  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    signal.removeEventListener("abort", onAbort);
    cleanup();
    void reader.cancel().catch(() => {
      // The upstream signal may have already closed the body.
    });
    reader.releaseLock();
  };

  return new ReadableStream<Uint8Array>({
    cancel() {
      finish();
      upstreamController.abort();
    },
    async pull(controller) {
      if (finished) {
        return;
      }
      try {
        while (true) {
          const { done, value } = await reader.read();
          // A timeout or disconnect can close the stream during reader.read().
          signal.throwIfAborted();
          if (done) {
            finish();
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const end = completeFrameEnd(buffer);
          if (end > 0) {
            controller.enqueue(encoder.encode(buffer.slice(0, end)));
            buffer = buffer.slice(end);
            return;
          }
        }
      } catch (error: unknown) {
        if (!finished) {
          finish();
          controller.error(error);
          upstreamController.abort();
        }
      }
    },
    start(controller) {
      onAbort = () => {
        finish();
        if (signal.reason === timeoutReason) {
          controller.enqueue(encoder.encode(timeoutEvent(address)));
        }
        controller.close();
      };
      signal.addEventListener("abort", onAbort, { once: true });
    },
  });
};

const openUpstreamWatch = async ({
  address,
  proxyDeadlineAt,
  request,
  token,
  upstreamUrl,
}: {
  address: string;
  proxyDeadlineAt: number;
  request: Request;
  token: string;
  upstreamUrl: string;
}): Promise<Response> => {
  const upstreamController = new AbortController();
  const timeoutReason = new DOMException(
    "Mempool proxy watch timed out.",
    "TimeoutError"
  );
  const timer = setTimeout(
    () => {
      upstreamController.abort(timeoutReason);
    },
    Math.max(0, proxyDeadlineAt - Date.now())
  );
  const onClientAbort = () => {
    upstreamController.abort();
  };
  request.signal.addEventListener("abort", onClientAbort, { once: true });
  const cleanup = () => {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", onClientAbort);
  };

  let upstream: Response | undefined;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-store",
        "x-api-token": token,
      },
      method: "GET",
      signal: upstreamController.signal,
    });
    upstreamController.signal.throwIfAborted();
  } catch (error: unknown) {
    cleanup();
    void upstream?.body?.cancel().catch(() => {
      // A late response body may already have been aborted.
    });
    if (upstreamController.signal.reason === timeoutReason) {
      return new Response(timeoutEvent(address), { headers: NO_STORE_HEADERS });
    }

    if (
      upstreamController.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      return new Response(null, { status: 499 });
    }

    const cause = describeFetchError(error);
    console.error("OnlyDoge mempool watch fetch failed", {
      cause,
      upstreamUrl,
    });

    return jsonError("Unable to reach OnlyDoge mempool watch.", 502, {
      cause,
      upstreamUrl,
    });
  }

  if (!upstream.ok) {
    cleanup();
    void upstream.body?.cancel().catch(() => {
      // The upstream error response body is no longer needed.
    });
    const message =
      upstream.status === 409
        ? "Another mempool watch session is already open for this API key."
        : `OnlyDoge mempool watch failed with status ${upstream.status}.`;

    console.error("OnlyDoge mempool watch upstream error", {
      status: upstream.status,
      upstreamUrl,
    });

    return jsonError(message, upstream.status === 409 ? 409 : 502, {
      status: String(upstream.status),
      upstreamUrl,
    });
  }

  const upstreamBody = upstream.body;
  if (!upstreamBody) {
    cleanup();
    return jsonError("OnlyDoge mempool watch returned an empty body.", 502);
  }

  return new Response(
    proxyBody(
      upstreamBody,
      address,
      upstreamController,
      timeoutReason,
      cleanup
    ),
    { headers: NO_STORE_HEADERS }
  );
};

export const GET = async (request: Request): Promise<Response> => {
  const proxyDeadlineAt = Date.now() + PROXY_WATCH_TIMEOUT_MS;
  const token = getOnlyDogeApiToken();
  if (!token) {
    return jsonError("ONLYDOGE_API_TOKEN is not configured.", 503);
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim() ?? "";
  const minValueBase = searchParams.get("minValueBase")?.trim();

  if (!address || !isDogecoinP2pkhAddress(address)) {
    return jsonError("A valid Dogecoin P2PKH address is required.", 400);
  }

  if (
    minValueBase !== undefined &&
    minValueBase.length > 0 &&
    !isNonNegativeBaseUnits(minValueBase)
  ) {
    return jsonError(
      "minValueBase must be a non-negative integer string in base units.",
      400
    );
  }

  const upstreamUrl = buildOnlyDogeMempoolWatchUrl(
    address,
    minValueBase && minValueBase.length > 0 ? minValueBase : undefined
  );

  if (request.signal.aborted) {
    return new Response(null, { status: 499 });
  }

  return await openUpstreamWatch({
    address,
    proxyDeadlineAt,
    request,
    token,
    upstreamUrl,
  });
};
