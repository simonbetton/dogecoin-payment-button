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

const encodeTimeoutEvent = (address: string): Uint8Array => {
  const payload = JSON.stringify({
    address,
    expiresAt: new Date().toISOString(),
  });

  return new TextEncoder().encode(
    `event: ${MEMPOOL_WATCH_TIMEOUT_EVENT}\ndata: ${payload}\n\n`
  );
};

const pipeUpstreamBody = async (
  body: ReadableStream<Uint8Array>,
  writable: WritableStream<Uint8Array>,
  address: string,
  proxyDeadlineAt: number,
  request: Request,
  onClientAbort: () => void,
  onProxyTimeout: () => void
): Promise<void> => {
  const writer = writable.getWriter();
  const reader = body.getReader();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  // oxlint-disable-next-line promise/avoid-new -- Adapts the callback timer for the stream read race.
  const proxyTimeout = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(
      () => {
        resolve("timeout");
      },
      Math.max(0, proxyDeadlineAt - Date.now())
    );
  });

  try {
    while (true) {
      const readResult = reader.read();
      const result = await Promise.race([
        readResult.then((value) => ({ type: "read" as const, value })),
        proxyTimeout.then((value) => ({ type: value })),
      ]);

      if (result.type === "timeout") {
        await writer.write(encodeTimeoutEvent(address));
        await writer.close();
        onProxyTimeout();
        try {
          await reader.cancel("Mempool proxy watch timed out.");
        } catch {
          // The upstream stream was already closed by the abort.
        }
        return;
      }

      const { done, value } = result.value;
      if (done) {
        break;
      }
      if (value) {
        await writer.write(value);
      }
    }
    await writer.close();
  } catch {
    try {
      await writer.abort();
    } catch {
      // Stream already closed.
    }
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    request.signal.removeEventListener("abort", onClientAbort);
    reader.releaseLock();
    writer.releaseLock();
  }
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

  const upstreamController = new AbortController();
  const onClientAbort = () => {
    upstreamController.abort();
  };
  request.signal.addEventListener("abort", onClientAbort, { once: true });

  let upstream: Response;
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
  } catch (error: unknown) {
    request.signal.removeEventListener("abort", onClientAbort);

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
    request.signal.removeEventListener("abort", onClientAbort);
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
    request.signal.removeEventListener("abort", onClientAbort);
    return jsonError("OnlyDoge mempool watch returned an empty body.", 502);
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  void pipeUpstreamBody(
    upstreamBody,
    writable,
    address,
    proxyDeadlineAt,
    request,
    onClientAbort,
    () => {
      upstreamController.abort();
    }
  );

  return new Response(readable, {
    headers: NO_STORE_HEADERS,
    status: 200,
  });
};
