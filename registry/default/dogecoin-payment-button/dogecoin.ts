import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58check } from "@scure/base";
import { HDKey } from "@scure/bip32";

const b58c = base58check(sha256);

/** Dogecoin Core BIP32 version bytes (`dgpv` / `dgub`). */
export const DOGECOIN_BIP32_VERSIONS = {
  private: 0x02_fa_c3_98,
  public: 0x02_fa_ca_fd,
} as const;

/** Bitcoin BIP32 version bytes accepted for account-public-key interchange. */
export const BITCOIN_BIP32_VERSIONS = {
  private: 0x04_88_ad_e4,
  public: 0x04_88_b2_1e,
} as const;

export const DOGECOIN_P2PKH_VERSION = 0x1e;
export const ACCOUNT_XPUB_DEPTH = 3;
export const EXTERNAL_CHAIN = 0;

export class DogecoinKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DogecoinKeyError";
  }
}

const detectPublicVersions = (extendedKey: string) => {
  if (extendedKey.startsWith("dgub")) {
    return DOGECOIN_BIP32_VERSIONS;
  }

  if (extendedKey.startsWith("xpub")) {
    return BITCOIN_BIP32_VERSIONS;
  }

  if (
    extendedKey.startsWith("dgpv") ||
    extendedKey.startsWith("xprv") ||
    extendedKey.startsWith("tprv") ||
    extendedKey.startsWith("tpub")
  ) {
    throw new DogecoinKeyError(
      "Private or testnet extended keys are not accepted. Provide an account-level dgub or xpub."
    );
  }

  throw new DogecoinKeyError(
    "Unsupported extended key encoding. Provide an account-level dgub or xpub."
  );
};

/**
 * Parse a Dogecoin BIP44 account-level public key (`m/44'/3'/0'`).
 * Accepts Dogecoin-native `dgub` and Bitcoin-compatible `xpub` encodings.
 */
export const parseAccountXpub = (extendedKey: string): HDKey => {
  const trimmed = extendedKey.trim();
  const versions = detectPublicVersions(trimmed);

  let key: HDKey;
  try {
    key = HDKey.fromExtendedKey(trimmed, versions);
  } catch {
    throw new DogecoinKeyError("Invalid extended public key encoding.");
  }

  if (key.privateKey) {
    throw new DogecoinKeyError("Private extended keys are not accepted.");
  }

  if (key.depth !== ACCOUNT_XPUB_DEPTH) {
    const depthHint =
      key.depth === ACCOUNT_XPUB_DEPTH + 1
        ? " This looks like a receive-chain key at m/44'/3'/0'/0 — export the account key at m/44'/3'/0' instead."
        : "";
    throw new DogecoinKeyError(
      `Expected an account-level key at depth ${ACCOUNT_XPUB_DEPTH} (m/44'/3'/0'), got depth ${key.depth}.${depthHint}`
    );
  }

  return key;
};

export const publicKeyToP2pkhAddress = (publicKey: Uint8Array): string => {
  const hash = ripemd160(sha256(publicKey));
  const payload = new Uint8Array(21);
  payload[0] = DOGECOIN_P2PKH_VERSION;
  payload.set(hash, 1);
  return b58c.encode(payload);
};

/**
 * Derive a mainnet Dogecoin P2PKH payment address for the external chain.
 * Relative path from the account xpub: `m/0/<addressIndex>`.
 */
export const derivePaymentAddress = (
  accountXpub: string,
  addressIndex: number
): string => {
  if (!Number.isInteger(addressIndex) || addressIndex < 0) {
    throw new DogecoinKeyError("Address index must be a non-negative integer.");
  }

  const account = parseAccountXpub(accountXpub);
  const child = account.derive(`m/${EXTERNAL_CHAIN}/${addressIndex}`);

  if (!child.publicKey) {
    throw new DogecoinKeyError(
      "Failed to derive a public key for the address."
    );
  }

  return publicKeyToP2pkhAddress(child.publicKey);
};

export const isDogecoinP2pkhAddress = (address: string): boolean => {
  try {
    const decoded = b58c.decode(address);
    return decoded.length === 21 && decoded[0] === DOGECOIN_P2PKH_VERSION;
  } catch {
    return false;
  }
};
