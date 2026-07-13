import { isDogecoinP2pkhAddress } from "./dogecoin";
import { normalizeDogecoinAmount } from "./payment-uri";

export const DOGE_BASE_UNITS_PER_COIN = 100_000_000;

export const MEMPOOL_WATCH_APPEARED_EVENT = "mempool.watch.appeared" as const;
export const MEMPOOL_WATCH_TIMEOUT_EVENT = "mempool.watch.timeout" as const;

export type MempoolWatchSource = "catchup" | "live";

export interface MempoolWatchOutput {
  valueBase: string;
  vout: number;
}

export interface MempoolWatchAppearedPayload {
  address: string;
  detectedAt: string;
  outputs: MempoolWatchOutput[];
  source: MempoolWatchSource;
  txid: string;
}

export interface MempoolWatchTimeoutPayload {
  address: string;
  expiresAt: string;
}

export type MempoolWatchStatus =
  | "idle"
  | "watching"
  | "appeared"
  | "timeout"
  | "busy"
  | "error";

export class MempoolWatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MempoolWatchError";
  }
}

export interface WatchMempoolOptions {
  address: string;
  endpoint: string;
  fetchImpl?: typeof fetch;
  minValueBase?: string;
  onAppeared: (payload: MempoolWatchAppearedPayload) => void;
  onBusy?: () => void;
  onError?: (error: Error) => void;
  onTimeout: (payload: MempoolWatchTimeoutPayload) => void;
  signal?: AbortSignal;
}

export interface WatchMempoolHandle {
  close: () => void;
}

interface SseFrame {
  data: string;
  event: string;
}

const BASE_UNITS_PATTERN = /^(?:0|[1-9]\d*)$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseSseFrame = (raw: string): SseFrame | null => {
  const lines = raw.split(/\r?\n/u);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.length === 0 || line.startsWith(":")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? "" : line.slice(separatorIndex + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    if (field === "event") {
      event = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    data: dataLines.join("\n"),
    event,
  };
};

/**
 * Convert a positive DOGE decimal string into base units
 * (1 DOGE = 100000000) as a non-negative integer string.
 */
export const dogeAmountToBaseUnits = (amount: string): string => {
  const normalized = normalizeDogecoinAmount(amount);
  const [wholePart, fractionalPart = ""] = normalized.split(".");
  const fractional = fractionalPart.padEnd(8, "0");
  const baseUnits =
    Number(wholePart) * DOGE_BASE_UNITS_PER_COIN + Number(fractional);

  if (!Number.isSafeInteger(baseUnits)) {
    throw new MempoolWatchError(
      "Amount is too large to convert to base units exactly."
    );
  }

  return String(baseUnits);
};

export const isNonNegativeBaseUnits = (value: string): boolean =>
  BASE_UNITS_PATTERN.test(value);

export const parseMempoolWatchAppearedPayload = (
  data: string
): MempoolWatchAppearedPayload => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data) as unknown;
  } catch {
    throw new MempoolWatchError("Appeared event payload is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new MempoolWatchError("Appeared event payload must be an object.");
  }

  const { address, detectedAt, outputs, source, txid } = parsed;

  if (typeof address !== "string" || !isDogecoinP2pkhAddress(address)) {
    throw new MempoolWatchError("Appeared event is missing a valid address.");
  }

  if (typeof txid !== "string" || txid.length === 0) {
    throw new MempoolWatchError("Appeared event is missing a txid.");
  }

  if (typeof detectedAt !== "string" || detectedAt.length === 0) {
    throw new MempoolWatchError("Appeared event is missing detectedAt.");
  }

  if (source !== "catchup" && source !== "live") {
    throw new MempoolWatchError("Appeared event has an invalid source.");
  }

  if (!Array.isArray(outputs) || outputs.length === 0) {
    throw new MempoolWatchError("Appeared event is missing outputs.");
  }

  const normalizedOutputs = outputs.map((output, index) => {
    if (!isRecord(output)) {
      throw new MempoolWatchError(
        `Appeared event output at index ${index} must be an object.`
      );
    }

    if (typeof output.vout !== "number" || !Number.isInteger(output.vout)) {
      throw new MempoolWatchError(
        `Appeared event output at index ${index} has an invalid vout.`
      );
    }

    if (
      typeof output.valueBase !== "string" ||
      !isNonNegativeBaseUnits(output.valueBase)
    ) {
      throw new MempoolWatchError(
        `Appeared event output at index ${index} has an invalid valueBase.`
      );
    }

    return {
      valueBase: output.valueBase,
      vout: output.vout,
    };
  });

  return {
    address,
    detectedAt,
    outputs: normalizedOutputs,
    source,
    txid,
  };
};

export const parseMempoolWatchTimeoutPayload = (
  data: string
): MempoolWatchTimeoutPayload => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data) as unknown;
  } catch {
    throw new MempoolWatchError("Timeout event payload is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new MempoolWatchError("Timeout event payload must be an object.");
  }

  const { address, expiresAt } = parsed;

  if (typeof address !== "string" || !isDogecoinP2pkhAddress(address)) {
    throw new MempoolWatchError("Timeout event is missing a valid address.");
  }

  if (typeof expiresAt !== "string" || expiresAt.length === 0) {
    throw new MempoolWatchError("Timeout event is missing expiresAt.");
  }

  return { address, expiresAt };
};

export const buildMempoolWatchEndpointUrl = (
  endpoint: string,
  address: string,
  minValueBase?: string
): string => {
  const url = new URL(endpoint, "http://localhost");
  const isAbsolute = /^https?:\/\//iu.test(endpoint);
  url.searchParams.set("address", address);
  if (minValueBase !== undefined) {
    url.searchParams.set("minValueBase", minValueBase);
  }

  if (isAbsolute) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
};

/**
 * Parse Server-Sent Events frames, honoring named `event:` fields.
 * Comment lines (`:`) and keep-alives are ignored.
 */
export const parseSseChunk = (
  buffer: string,
  chunk: string
): { frames: SseFrame[]; remaining: string } => {
  const combined = `${buffer}${chunk}`;
  const parts = combined.split(/\r?\n\r?\n/u);
  const remaining = parts.pop() ?? "";
  const frames: SseFrame[] = [];

  for (const part of parts) {
    const frame = parseSseFrame(part);
    if (frame) {
      frames.push(frame);
    }
  }

  return { frames, remaining };
};

type WatchOutcome =
  | { type: "appeared"; payload: MempoolWatchAppearedPayload }
  | { type: "timeout"; payload: MempoolWatchTimeoutPayload }
  | { type: "busy" }
  | { type: "error"; error: Error }
  | { type: "closed" };

const dispatchOutcome = (
  options: WatchMempoolOptions,
  outcome: WatchOutcome
): void => {
  switch (outcome.type) {
    case "appeared": {
      options.onAppeared(outcome.payload);
      break;
    }
    case "timeout": {
      options.onTimeout(outcome.payload);
      break;
    }
    case "busy": {
      options.onBusy?.();
      break;
    }
    case "error": {
      options.onError?.(outcome.error);
      break;
    }
    default: {
      break;
    }
  }
};

const readWatchOutcome = async (
  response: Response,
  shouldStop: () => boolean
): Promise<WatchOutcome> => {
  if (response.status === 409) {
    return { type: "busy" };
  }

  if (!response.ok) {
    return {
      error: new MempoolWatchError(
        `Mempool watch failed with status ${response.status}.`
      ),
      type: "error",
    };
  }

  if (!response.body) {
    return {
      error: new MempoolWatchError("Mempool watch response had no body."),
      type: "error",
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!shouldStop()) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const decoded = decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer, decoded);
    buffer = parsed.remaining;

    for (const frame of parsed.frames) {
      if (frame.event === MEMPOOL_WATCH_APPEARED_EVENT) {
        try {
          return {
            payload: parseMempoolWatchAppearedPayload(frame.data),
            type: "appeared",
          };
        } catch (error) {
          return {
            error:
              error instanceof Error
                ? error
                : new MempoolWatchError("Failed to parse appeared event."),
            type: "error",
          };
        }
      }

      if (frame.event === MEMPOOL_WATCH_TIMEOUT_EVENT) {
        try {
          return {
            payload: parseMempoolWatchTimeoutPayload(frame.data),
            type: "timeout",
          };
        } catch (error) {
          return {
            error:
              error instanceof Error
                ? error
                : new MempoolWatchError("Failed to parse timeout event."),
            type: "error",
          };
        }
      }
    }
  }

  if (shouldStop()) {
    return { type: "closed" };
  }

  return {
    error: new MempoolWatchError(
      "Mempool watch ended before a payment appeared."
    ),
    type: "error",
  };
};

/**
 * Open a one-shot SSE mempool watch session for a receive address.
 * Uses fetch streaming so HTTP statuses like 409 are observable while still
 * dispatching on named `event:` frames.
 */
export const watchMempoolPayment = (
  options: WatchMempoolOptions
): WatchMempoolHandle => {
  const {
    address,
    endpoint,
    fetchImpl = fetch,
    minValueBase,
    signal,
  } = options;

  if (!isDogecoinP2pkhAddress(address)) {
    throw new MempoolWatchError("Cannot watch an invalid Dogecoin address.");
  }

  if (minValueBase !== undefined && !isNonNegativeBaseUnits(minValueBase)) {
    throw new MempoolWatchError(
      "minValueBase must be a non-negative integer string."
    );
  }

  const controller = new AbortController();
  let settled = false;

  const close = () => {
    if (settled) {
      return;
    }
    settled = true;
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      close();
      return { close };
    }
    signal.addEventListener("abort", close, { once: true });
  }

  const url = buildMempoolWatchEndpointUrl(endpoint, address, minValueBase);

  void (async () => {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-store",
        },
        method: "GET",
        signal: controller.signal,
      });

      if (settled) {
        return;
      }

      const outcome = await readWatchOutcome(response, () => settled);
      if (settled || outcome.type === "closed") {
        return;
      }

      settled = true;
      controller.abort();
      dispatchOutcome(options, outcome);
    } catch (error: unknown) {
      if (
        settled ||
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }

      settled = true;
      dispatchOutcome(options, {
        error:
          error instanceof Error
            ? error
            : new MempoolWatchError("Mempool watch connection failed."),
        type: "error",
      });
    }
  })();

  return { close };
};
