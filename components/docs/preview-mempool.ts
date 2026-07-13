/** Well-known Dogecoin P2PKH address used only for the docs Preview. */
export const PREVIEW_DOGECOIN_ADDRESS = "DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B";

const PREVIEW_TXID =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/** Simulated delay before the Preview mempool watch reports a payment. */
export const PREVIEW_MEMPOOL_DELAY_MS = 3000;

const encodeSse = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const resolveRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

const createFakeMempoolResponse = (address: string): Response => {
  const encoder = new TextEncoder();
  let timeoutId: number | undefined;

  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    },
    start(controller) {
      controller.enqueue(encoder.encode(": keep-alive\n\n"));
      timeoutId = window.setTimeout(() => {
        try {
          controller.enqueue(
            encoder.encode(
              encodeSse("mempool.watch.appeared", {
                address,
                detectedAt: new Date().toISOString(),
                outputs: [{ valueBase: "50000000", vout: 0 }],
                source: "live",
                txid: PREVIEW_TXID,
              })
            )
          );
          controller.close();
        } catch {
          // Stream already cancelled.
        }
      }, PREVIEW_MEMPOOL_DELAY_MS);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
    status: 200,
  });
};

export const fakeMempoolFetch: typeof fetch = (input) => {
  const url = resolveRequestUrl(input);
  const address =
    new URL(url, "http://localhost").searchParams.get("address") ??
    PREVIEW_DOGECOIN_ADDRESS;

  return Promise.resolve(createFakeMempoolResponse(address));
};
