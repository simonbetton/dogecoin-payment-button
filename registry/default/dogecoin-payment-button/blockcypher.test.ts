import { afterEach, describe, expect, it, vi } from "vitest";

import { createBlockCypherAddressUsageChecker } from "./blockcypher";

describe(createBlockCypherAddressUsageChecker, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("spaces concurrent checks and skips a canceled waiter", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const startedAt = Date.now() + 1000;
    vi.setSystemTime(startedAt);
    const fetchImpl = vi.fn<typeof fetch>(() => {
      starts.push(Date.now() - startedAt);
      return Promise.resolve(Response.json({ final_n_tx: 0 }));
    });
    const checker = createBlockCypherAddressUsageChecker({ fetchImpl });
    const controller = new AbortController();
    const first = checker("first");
    const canceled = checker("canceled", controller.signal);

    const second = checker("second");
    const third = checker("third");
    controller.abort();
    await expect(canceled).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1050);
    await Promise.all([first, second, third]);

    expect(starts).toStrictEqual([0, 350, 700]);
  });

  it("treats final_n_tx > 0 as used", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ final_n_tx: 2 }))
    );

    const checker = createBlockCypherAddressUsageChecker({
      fetchImpl,
      requestIntervalMs: 0,
    });

    await expect(
      checker("DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B")
    ).resolves.toBeTruthy();
  });

  it("treats final_n_tx === 0 as unused", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ final_n_tx: 0 }))
    );

    const checker = createBlockCypherAddressUsageChecker({
      fetchImpl,
      requestIntervalMs: 0,
    });

    await expect(
      checker("DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B")
    ).resolves.toBeFalsy();
  });

  it("rejects an invalid transaction count instead of reporting an unused address", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ final_n_tx: -1 }))
    );
    const checker = createBlockCypherAddressUsageChecker({
      fetchImpl,
      requestIntervalMs: 0,
    });

    await expect(checker("address")).rejects.toThrow(/final_n_tx/u);
  });

  it("throws on HTTP and malformed responses", async () => {
    const failingFetch = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("nope", { status: 429 }))
    );
    const failing = createBlockCypherAddressUsageChecker({
      fetchImpl: failingFetch,
      requestIntervalMs: 0,
    });

    await expect(failing("DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B")).rejects.toThrow(
      /status 429/u
    );

    const malformedFetch = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({}))
    );
    const malformed = createBlockCypherAddressUsageChecker({
      fetchImpl: malformedFetch,
      requestIntervalMs: 0,
    });

    await expect(
      malformed("DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B")
    ).rejects.toThrow(/final_n_tx/u);
  });
});
