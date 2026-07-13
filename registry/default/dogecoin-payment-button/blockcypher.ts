import type { AddressUsageChecker } from "./address-selection";

export const BLOCKCYPHER_DOGE_ADDRESS_URL =
  "https://api.blockcypher.com/v1/doge/main/addrs";

/** Stay under BlockCypher's free-tier 3 req/sec limit. */
export const DEFAULT_REQUEST_INTERVAL_MS = 350;

export interface BlockCypherCheckerOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestIntervalMs?: number;
  token?: string;
}

interface BlockCypherAddressResponse {
  final_n_tx?: number;
}

interface TimeoutRef {
  current?: ReturnType<typeof setTimeout>;
}

let lastRequestAt = 0;

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  // oxlint-disable-next-line promise/avoid-new -- Abortable timers require coordinating resolve and reject callbacks.
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Address check aborted.", "AbortError"));
      return;
    }

    const timeoutRef: TimeoutRef = {};

    const onAbort = () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
      reject(new DOMException("Address check aborted.", "AbortError"));
    };

    timeoutRef.current = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });

const paceRequests = async (
  intervalMs: number,
  signal?: AbortSignal
): Promise<void> => {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < intervalMs) {
    await sleep(intervalMs - elapsed, signal);
  }
  lastRequestAt = Date.now();
};

/**
 * Default Address Usage Checker backed by BlockCypher's Dogecoin address API.
 * An address is used when `final_n_tx > 0` (confirmed or mempool activity).
 */
export const createBlockCypherAddressUsageChecker = (
  options: BlockCypherCheckerOptions = {}
): AddressUsageChecker => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const intervalMs = options.requestIntervalMs ?? DEFAULT_REQUEST_INTERVAL_MS;
  const baseUrl = options.baseUrl ?? BLOCKCYPHER_DOGE_ADDRESS_URL;

  return async (address, signal) => {
    await paceRequests(intervalMs, signal);

    const url = new URL(`${baseUrl}/${address}`);
    if (options.token) {
      url.searchParams.set("token", options.token);
    }

    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      method: "GET",
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `BlockCypher address lookup failed with status ${response.status}.`
      );
    }

    const body = (await response.json()) as BlockCypherAddressResponse;

    if (typeof body.final_n_tx !== "number") {
      throw new TypeError("BlockCypher response is missing final_n_tx.");
    }

    return body.final_n_tx > 0;
  };
};

export const defaultAddressUsageChecker =
  createBlockCypherAddressUsageChecker();
