import { describe, expect, it, vi } from "vitest";

import { createBlockCypherAddressUsageChecker } from "./blockcypher";

describe(createBlockCypherAddressUsageChecker, () => {
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
