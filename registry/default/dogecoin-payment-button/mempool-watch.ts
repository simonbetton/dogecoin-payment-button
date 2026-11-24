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
  return `${wholePart}${fractionalPart.padEnd(8, "0")}`.replace(
    /^0+(?=\d)/u,
    ""
  );
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

  const outputIndexes = new Set<number>();
  const normalizedOutputs = outputs.map((output, index) => {
    if (!isRecord(output)) {
      throw new MempoolWatchError(
        `Appeared event output at index ${index} must be an object.`
      );
    }

    if (
      typeof output.vout !== "number" ||
      !Number.isSafeInteger(output.vout) ||
      output.vout < 0 ||
      outputIndexes.has(output.vout)
    ) {
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

    outputIndexes.add(output.vout);
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

const meetsMinimum = (
  outputs: MempoolWatchOutput[],
  minimum: bigint
): boolean => {
  let remaining = minimum;
  for (const output of outputs) {
    remaining -= BigInt(output.valueBase);
  }
  return remaining <= 0;
};

const matchWatchFrame = (
  frame: SseFrame,
  address: string,
  minimum: bigint
): WatchOutcome | undefined => {
  if (frame.event === MEMPOOL_WATCH_APPEARED_EVENT) {
    const payload = parseMempoolWatchAppearedPayload(frame.data);
    if (payload.address === address && meetsMinimum(payload.outputs, minimum)) {
      return { payload, type: "appeared" };
    }
  } else if (frame.event === MEMPOOL_WATCH_TIMEOUT_EVENT) {
    const payload = parseMempoolWatchTimeoutPayload(frame.data);
    if (payload.address === address) {
      return { payload, type: "timeout" };
    }
  }
  return undefined;
};

const readWatchOutcome = async (
  response: Response,
  signal: AbortSignal,
  address: string,
  minimum: bigint
): Promise<WatchOutcome> => {
  if (response.status === 409) {
    return { type: "busy" };
  }

  if (!response.ok) {
    throw new MempoolWatchError(
      `Mempool watch failed with status ${response.status}.`
    );
  }

  if (!response.body) {
    throw new MempoolWatchError("Mempool watch response had no body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const cancelReader = () => {
    // The network may have already closed the body when the signal fired.
    void reader.cancel().catch(() => {
      /* The stream is already closed or errored. */
    });
  };
  signal.addEventListener("abort", cancelReader, { once: true });

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (signal.aborted) {
        return { type: "closed" };
      }
      if (done) {
        throw new MempoolWatchError(
          "Mempool watch ended before a payment appeared."
        );
      }

      const parsed = parseSseChunk(
        buffer,
        decoder.decode(value, { stream: true })
      );
      buffer = parsed.remaining;
      for (const frame of parsed.frames) {
        const outcome = matchWatchFrame(frame, address, minimum);
        if (outcome) {
          return outcome;
        }
      }
    }
    return { type: "closed" };
  } finally {
    signal.removeEventListener("abort", cancelReader);
    if (!signal.aborted) {
      cancelReader();
    }
    reader.releaseLock();
  }
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

  const url = buildMempoolWatchEndpointUrl(endpoint, address, minValueBase);
  const minimum = BigInt(minValueBase ?? "0");
  const controller = new AbortController();
  let settled = false;

  const close = () => {
    if (settled) {
      return;
    }
    settled = true;
    signal?.removeEventListener("abort", close);
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) {
      close();
      return { close };
    }
    signal.addEventListener("abort", close, { once: true });
  }

  void (async () => {
    let response: Response | undefined;
    let outcome: WatchOutcome;
    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-store",
        },
        method: "GET",
        signal: controller.signal,
      });

      outcome = settled
        ? { type: "closed" }
        : await readWatchOutcome(response, controller.signal, address, minimum);
    } catch (error: unknown) {
      outcome = {
        error:
          error instanceof Error
            ? error
            : new MempoolWatchError("Mempool watch connection failed."),
        type: "error",
      };
    } finally {
      if (response?.body && !response.bodyUsed) {
        void response.body.cancel().catch(() => {
          /* The stream is already closed or errored. */
        });
      }
    }

    if (!settled) {
      close();
      try {
        dispatchOutcome(options, outcome);
      } catch {
        // Consumer callbacks cannot change the terminal transport outcome.
      }
    }
  })();

  return { close };
};
