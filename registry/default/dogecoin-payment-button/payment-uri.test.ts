import { describe, expect, it } from "vitest";

import {
  buildDogecoinPaymentUri,
  normalizeDogecoinAmount,
} from "./payment-uri";

describe(normalizeDogecoinAmount, () => {
  it("accepts valid decimal strings", () => {
    expect(normalizeDogecoinAmount("10")).toBe("10");
    expect(normalizeDogecoinAmount("10.5")).toBe("10.5");
    expect(normalizeDogecoinAmount("0.00000001")).toBe("0.00000001");
  });

  it("rejects invalid amounts", () => {
    expect(() => normalizeDogecoinAmount("0")).toThrow(/greater than zero/u);
    expect(() => normalizeDogecoinAmount("-1")).toThrow(/positive decimal/u);
    expect(() => normalizeDogecoinAmount("1.123456789")).toThrow(
      /positive decimal/u
    );
    expect(() => normalizeDogecoinAmount("abc")).toThrow(/positive decimal/u);
  });
});

describe(buildDogecoinPaymentUri, () => {
  it("builds address-only and amount URIs", () => {
    expect(buildDogecoinPaymentUri("DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B")).toBe(
      "dogecoin:DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B"
    );

    expect(
      buildDogecoinPaymentUri("DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B", "8.25")
    ).toBe("dogecoin:DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B?amount=8.25");
  });
});
