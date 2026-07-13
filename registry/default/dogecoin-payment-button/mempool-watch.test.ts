import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildMempoolWatchEndpointUrl,
  dogeAmountToBaseUnits,
  isNonNegativeBaseUnits,
  parseMempoolWatchAppearedPayload,
  parseMempoolWatchTimeoutPayload,
  parseSseChunk,
  watchMempoolPayment,
} from "./mempool-watch";
import type {
  MempoolWatchAppearedPayload,
  MempoolWatchTimeoutPayload,
} from "./mempool-watch";

const ADDRESS = "DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B";

const appearedPayload: MempoolWatchAppearedPayload = {
  address: ADDRESS,
  detectedAt: "2026-07-13T01:00:00.000Z",
  outputs: [{ valueBase: "1000000000", vout: 0 }],
  source: "live",
  txid: "abc123",
};

const timeoutPayload: MempoolWatchTimeoutPayload = {
  address: ADDRESS,
  expiresAt: "2026-07-13T01:05:00.000Z",
};

const encodeSse = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const createStreamResponse = (chunks: string[], status = 200): Response => {
  const encoder = new TextEncoder();
  let index = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
    },
    status,
  });
};

describe(dogeAmountToBaseUnits, () => {
  it("converts whole and fractional DOGE amounts exactly", () => {
    expect(dogeAmountToBaseUnits("1")).toBe("100000000");
    expect(dogeAmountToBaseUnits("10")).toBe("1000000000");
    expect(dogeAmountToBaseUnits("0.00000001")).toBe("1");
    expect(dogeAmountToBaseUnits("8.25")).toBe("825000000");
  });
});

describe(isNonNegativeBaseUnits, () => {
  it("accepts non-negative integer strings only", () => {
    expect(isNonNegativeBaseUnits("0")).toBeTruthy();
    expect(isNonNegativeBaseUnits("100000000")).toBeTruthy();
    expect(isNonNegativeBaseUnits("-1")).toBeFalsy();
    expect(isNonNegativeBaseUnits("1.5")).toBeFalsy();
    expect(isNonNegativeBaseUnits("01")).toBeFalsy();
  });
});

describe(parseMempoolWatchAppearedPayload, () => {
  it("parses a valid appeared payload", () => {
    expect(
      parseMempoolWatchAppearedPayload(JSON.stringify(appearedPayload))
    ).toStrictEqual(appearedPayload);
  });

  it("rejects malformed appeared payloads", () => {
    expect(() => parseMempoolWatchAppearedPayload("{")).toThrow(/valid JSON/u);
    expect(() =>
      parseMempoolWatchAppearedPayload(
        JSON.stringify({ ...appearedPayload, address: "not-an-address" })
      )
    ).toThrow(/valid address/u);
    expect(() =>
      parseMempoolWatchAppearedPayload(
        JSON.stringify({ ...appearedPayload, source: "unknown" })
      )
    ).toThrow(/invalid source/u);
  });
});

describe(parseMempoolWatchTimeoutPayload, () => {
  it("parses a valid timeout payload", () => {
    expect(
      parseMempoolWatchTimeoutPayload(JSON.stringify(timeoutPayload))
    ).toStrictEqual(timeoutPayload);
  });

  it("rejects malformed timeout payloads", () => {
    expect(() =>
      parseMempoolWatchTimeoutPayload(JSON.stringify({ address: ADDRESS }))
    ).toThrow(/expiresAt/u);
  });
});

describe(parseSseChunk, () => {
  it("parses named events and ignores keep-alive comments", () => {
    const { frames, remaining } = parseSseChunk(
      "",
      `: keep-alive\n\nevent: mempool.watch.appeared\ndata: ${JSON.stringify(appearedPayload)}\n\npartial`
    );

    expect(frames).toStrictEqual([
      {
        data: JSON.stringify(appearedPayload),
        event: "mempool.watch.appeared",
      },
    ]);
    expect(remaining).toBe("partial");
  });
});

describe(buildMempoolWatchEndpointUrl, () => {
  it("builds relative and absolute watch URLs", () => {
    expect(
      buildMempoolWatchEndpointUrl("/api/dogecoin/mempool/watch", ADDRESS, "10")
    ).toBe(`/api/dogecoin/mempool/watch?address=${ADDRESS}&minValueBase=10`);

    expect(
      buildMempoolWatchEndpointUrl("https://example.com/watch", ADDRESS)
    ).toBe(`https://example.com/watch?address=${ADDRESS}`);
  });
});

describe(watchMempoolPayment, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes onAppeared for the first qualifying named event", async () => {
    const onAppeared = vi.fn<(payload: MempoolWatchAppearedPayload) => void>();
    const onTimeout = vi.fn<(payload: MempoolWatchTimeoutPayload) => void>();
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        createStreamResponse([
          ": ping\n\n",
          encodeSse("mempool.watch.appeared", appearedPayload),
        ])
      )
    );

    watchMempoolPayment({
      address: ADDRESS,
      endpoint: "/api/dogecoin/mempool/watch",
      fetchImpl,
      minValueBase: "1000000000",
      onAppeared,
      onTimeout,
    });

    await vi.waitFor(() => {
      expect(onAppeared).toHaveBeenCalledWith(appearedPayload);
    });
    expect(onTimeout).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/dogecoin/mempool/watch?address=${ADDRESS}&minValueBase=1000000000`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "text/event-stream",
        }),
        method: "GET",
      })
    );
  });

  it("invokes onTimeout for the timeout event", async () => {
    const onAppeared = vi.fn<(payload: MempoolWatchAppearedPayload) => void>();
    const onTimeout = vi.fn<(payload: MempoolWatchTimeoutPayload) => void>();
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        createStreamResponse([
          encodeSse("mempool.watch.timeout", timeoutPayload),
        ])
      )
    );

    watchMempoolPayment({
      address: ADDRESS,
      endpoint: "/api/dogecoin/mempool/watch",
      fetchImpl,
      onAppeared,
      onTimeout,
    });

    await vi.waitFor(() => {
      expect(onTimeout).toHaveBeenCalledWith(timeoutPayload);
    });
    expect(onAppeared).not.toHaveBeenCalled();
  });

  it("invokes onBusy for HTTP 409", async () => {
    const onBusy = vi.fn<() => void>();
    const onError = vi.fn<(error: Error) => void>();
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json(
          { error: "Another mempool watch session is already open." },
          { status: 409 }
        )
      )
    );

    watchMempoolPayment({
      address: ADDRESS,
      endpoint: "/api/dogecoin/mempool/watch",
      fetchImpl,
      onAppeared: vi.fn<(payload: MempoolWatchAppearedPayload) => void>(),
      onBusy,
      onError,
      onTimeout: vi.fn<(payload: MempoolWatchTimeoutPayload) => void>(),
    });

    await vi.waitFor(() => {
      expect(onBusy).toHaveBeenCalledOnce();
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("invokes onError for malformed named events", async () => {
    const onError = vi.fn<(error: Error) => void>();
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        createStreamResponse([
          "event: mempool.watch.appeared\ndata: {not-json}\n\n",
        ])
      )
    );

    watchMempoolPayment({
      address: ADDRESS,
      endpoint: "/api/dogecoin/mempool/watch",
      fetchImpl,
      onAppeared: vi.fn<(payload: MempoolWatchAppearedPayload) => void>(),
      onError,
      onTimeout: vi.fn<(payload: MempoolWatchTimeoutPayload) => void>(),
    });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledOnce();
    });
  });

  it("cancels the request when close is called", async () => {
    let aborted = false;
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
      });

      return Promise.resolve(createStreamResponse([": keep-alive\n\n"]));
    });

    const handle = watchMempoolPayment({
      address: ADDRESS,
      endpoint: "/api/dogecoin/mempool/watch",
      fetchImpl,
      onAppeared: vi.fn<(payload: MempoolWatchAppearedPayload) => void>(),
      onTimeout: vi.fn<(payload: MempoolWatchTimeoutPayload) => void>(),
    });

    await vi.waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledOnce();
    });

    handle.close();
    expect(aborted).toBeTruthy();
  });
});
