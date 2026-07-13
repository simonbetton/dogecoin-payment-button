import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ADDRESS_INDEX_STEP,
  DEFAULT_MAX_ATTEMPTS,
  selectPaymentAddress,
} from "./address-selection";
import type { AddressUsageChecker } from "./address-selection";

const derive = (index: number): string => `ADDR_${index}`;

describe(selectPaymentAddress, () => {
  it("returns the first unused address and reuses that index next", async () => {
    const checker = vi.fn<AddressUsageChecker>((address) =>
      Promise.resolve(address !== "ADDR_0")
    );

    const result = await selectPaymentAddress({
      checker,
      deriveAddress: derive,
    });

    expect(result).toStrictEqual({
      address: "ADDR_0",
      index: 0,
      mode: "verified",
      nextStartIndex: 0,
      uncheckedMode: false,
    });
    expect(checker).toHaveBeenCalledOnce();
  });

  it("steps by addressIndexStep when earlier candidates are used", async () => {
    const checker = vi.fn<AddressUsageChecker>((address) =>
      Promise.resolve(address !== "ADDR_19")
    );

    const result = await selectPaymentAddress({
      addressIndexStep: DEFAULT_ADDRESS_INDEX_STEP,
      checker,
      deriveAddress: derive,
    });

    expect(result.index).toBe(19);
    expect(result.mode).toBe("verified");
    expect(result.nextStartIndex).toBe(19);
    expect(checker.mock.calls.map((call) => call[0])).toStrictEqual([
      "ADDR_0",
      "ADDR_19",
    ]);
  });

  it("uses the constant sequence 0, 19, 38, …, 361 over 20 used checks", async () => {
    const seen: number[] = [];
    const checker = vi.fn<AddressUsageChecker>(() => Promise.resolve(true));

    const result = await selectPaymentAddress({
      addressIndexStep: DEFAULT_ADDRESS_INDEX_STEP,
      checker,
      deriveAddress: (index) => {
        seen.push(index);
        return derive(index);
      },
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
    });

    expect(seen).toStrictEqual(
      Array.from({ length: 20 }, (_, attempt) => attempt * 19)
    );
    expect(seen.at(-1)).toBe(361);
    expect(result).toStrictEqual({
      address: "ADDR_361",
      index: 361,
      mode: "exhausted",
      nextStartIndex: 380,
      uncheckedMode: true,
    });
  });

  it("falls back to the next unchecked index on provider errors", async () => {
    const checker = vi.fn<AddressUsageChecker>(() =>
      Promise.reject(new Error("rate limited"))
    );

    const result = await selectPaymentAddress({
      addressIndexStep: 19,
      checker,
      deriveAddress: derive,
      startIndex: 0,
    });

    expect(result).toStrictEqual({
      address: "ADDR_19",
      index: 19,
      mode: "transient-fallback",
      nextStartIndex: 19,
      uncheckedMode: false,
    });
  });

  it("skips checks entirely in unchecked mode and increments", async () => {
    const checker = vi.fn<AddressUsageChecker>(() => Promise.resolve(true));

    const result = await selectPaymentAddress({
      addressIndexStep: 19,
      checker,
      deriveAddress: derive,
      startIndex: 361,
      uncheckedMode: true,
    });

    expect(checker).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      address: "ADDR_361",
      index: 361,
      mode: "unchecked",
      nextStartIndex: 380,
      uncheckedMode: true,
    });
  });

  it("aborts when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      selectPaymentAddress({
        checker: () => Promise.resolve(false),
        deriveAddress: derive,
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("propagates abort errors from the checker", async () => {
    const controller = new AbortController();

    await expect(
      selectPaymentAddress({
        checker: () => {
          controller.abort();
          return Promise.reject(
            new DOMException("Address check aborted.", "AbortError")
          );
        },
        deriveAddress: derive,
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
