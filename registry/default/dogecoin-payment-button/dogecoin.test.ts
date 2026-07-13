import { describe, expect, it } from "vitest";

import {
  derivePaymentAddress,
  isDogecoinP2pkhAddress,
  parseAccountXpub,
} from "./dogecoin";

/**
 * Account key at m/44'/3'/0' from the Dogecoin Foundation libdogecoin
 * master-key example (`dgpv51eADS3spNJh8h13…`).
 */
const ACCOUNT_DGUB =
  "dgub8rTWf9J4m5g3dz2BAPmJHJ5GbBfeS6H7wrPbbCtSsf4ik4HN5VezibcWdCVdeqj1NaEEnuSGfmf3vk5tHZyYWSmiA7RdHKaRk2RxqZ7yMnZ";

const ACCOUNT_XPUB =
  "xpub6Bwh5PFUDzJdTk9os6xLrCnMLtX9NX8buQC51ttDZSGzBrsu8q8e3YXpG7zeGsKYNqiMM1jy4mT6v1mriqKoWcvA8R27m3oKPS9M7wAwugq";

const EXPECTED_ADDRESSES = {
  0: "DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B",
  19: "DCzqVvn9NB1QuqBAmvKwvsKA4YXmsZhVir",
  38: "D6hM9G6mDP4VecKSY1hjXpEepgeFeXB5rJ",
} as const;

describe(parseAccountXpub, () => {
  it("accepts Dogecoin-native dgub account keys", () => {
    const key = parseAccountXpub(ACCOUNT_DGUB);
    expect(key.depth).toBe(3);
    expect(key.privateKey).toBeNull();
  });

  it("accepts Bitcoin-compatible xpub account keys", () => {
    const key = parseAccountXpub(ACCOUNT_XPUB);
    expect(key.depth).toBe(3);
  });

  it("rejects private extended keys", () => {
    expect(() =>
      parseAccountXpub(
        "dgpv51eADS3spNJh8h13wso3DdDAw3EJRqWvftZyjTNCFEG7gqV6zsZmucmJR6xZfvgfmzUthVC6LNicBeNNDQdLiqjQJjPeZnxG8uW3Q3gCA3e"
      )
    ).toThrow(/Private or testnet/u);
  });

  it("rejects non-account depths", () => {
    const externalChainKey =
      "dgub8uRxxQmZ2rAJLqGgqd4CLAMwVGG5gYTEhbYC614eoYTsib5FaDiKXfKApkfbXySAKDEzo3xosb8PDNKeefu7qNVmTwSSW15ocYyER24HeqU";

    expect(() => parseAccountXpub(externalChainKey)).toThrow(
      /account-level key/u
    );
  });
});

describe(derivePaymentAddress, () => {
  it("matches the Dogecoin Foundation first external address", () => {
    expect(derivePaymentAddress(ACCOUNT_DGUB, 0)).toBe(EXPECTED_ADDRESSES[0]);
  });

  it("derives matching addresses from dgub and xpub", () => {
    for (const [index, address] of Object.entries(EXPECTED_ADDRESSES)) {
      const i = Number(index);
      expect(derivePaymentAddress(ACCOUNT_DGUB, i)).toBe(address);
      expect(derivePaymentAddress(ACCOUNT_XPUB, i)).toBe(address);
    }
  });

  it("rejects negative indexes", () => {
    expect(() => derivePaymentAddress(ACCOUNT_DGUB, -1)).toThrow(
      /non-negative/u
    );
  });
});

describe(isDogecoinP2pkhAddress, () => {
  it("accepts mainnet P2PKH addresses", () => {
    expect(isDogecoinP2pkhAddress(EXPECTED_ADDRESSES[0])).toBeTruthy();
  });

  it("rejects invalid addresses", () => {
    expect(isDogecoinP2pkhAddress("not-an-address")).toBeFalsy();
    expect(
      isDogecoinP2pkhAddress("1BoatSLRHtKNfrhpphLbnRXYQ53GgDTqsd")
    ).toBeFalsy();
  });
});
