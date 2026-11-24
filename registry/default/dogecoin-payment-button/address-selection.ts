import { EXHAUSTED_ADDRESS_INDEX } from "./dogecoin";

export const DEFAULT_ADDRESS_INDEX_STEP = 19;
export const DEFAULT_MAX_ATTEMPTS = 20;

export type AddressUsageChecker = (
  address: string,
  signal?: AbortSignal
) => Promise<boolean>;

export type SelectionMode =
  | "verified"
  | "transient-fallback"
  | "exhausted"
  | "unchecked";

export interface SelectionState {
  startIndex: number;
  uncheckedMode: boolean;
}

export class AddressSelectionExhaustedError extends Error {
  constructor() {
    super("No payment address indices remain on the receive chain.");
    this.name = "AddressSelectionExhaustedError";
  }
}

export const isSelectionState = (value: unknown): value is SelectionState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { startIndex, uncheckedMode } = value as Partial<SelectionState>;
  return (
    typeof startIndex === "number" &&
    Number.isInteger(startIndex) &&
    startIndex >= 0 &&
    typeof uncheckedMode === "boolean" &&
    (startIndex < EXHAUSTED_ADDRESS_INDEX ||
      (startIndex === EXHAUSTED_ADDRESS_INDEX && uncheckedMode))
  );
};

const nextIndex = (index: number, step: number): number =>
  Math.min(index + step, EXHAUSTED_ADDRESS_INDEX);

export interface AddressSelectionResult {
  address: string;
  index: number;
  mode: SelectionMode;
  nextStartIndex: number;
  uncheckedMode: boolean;
}

export interface AddressSelectionOptions {
  addressIndexStep?: number;
  checker: AddressUsageChecker;
  deriveAddress: (index: number) => string;
  maxAttempts?: number;
  signal?: AbortSignal;
  startIndex?: number;
  uncheckedMode?: boolean;
}

const assertNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new DOMException("Address selection aborted.", "AbortError");
  }
};

/**
 * Select a payment address using the stepped discovery sequence.
 *
 * From `startIndex`, candidates are `start, start+step, …` for up to
 * `maxAttempts` checks. An unused address is reused on later opens until it
 * becomes used. Provider errors fall back to the next unchecked index for the
 * current opening and retry discovery from that index next time. After
 * `maxAttempts` used results, the final known-used candidate is returned and
 * the instance enters permanent unchecked mode (increment-only, no checks).
 */
export const selectPaymentAddress = async (
  options: AddressSelectionOptions
): Promise<AddressSelectionResult> => {
  const addressIndexStep =
    options.addressIndexStep ?? DEFAULT_ADDRESS_INDEX_STEP;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const startIndex = options.startIndex ?? 0;
  const uncheckedMode = options.uncheckedMode ?? false;

  if (!Number.isSafeInteger(addressIndexStep) || addressIndexStep < 1) {
    throw new Error("addressIndexStep must be a positive integer.");
  }

  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer.");
  }

  if (!isSelectionState({ startIndex, uncheckedMode })) {
    throw new Error(
      "startIndex must be a non-hardened BIP32 index or an exhausted cursor."
    );
  }

  assertNotAborted(options.signal);

  if (startIndex === EXHAUSTED_ADDRESS_INDEX) {
    throw new AddressSelectionExhaustedError();
  }

  if (uncheckedMode) {
    const address = options.deriveAddress(startIndex);
    return {
      address,
      index: startIndex,
      mode: "unchecked",
      nextStartIndex: nextIndex(startIndex, addressIndexStep),
      uncheckedMode: true,
    };
  }

  let index = startIndex;
  let address = "";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    assertNotAborted(options.signal);
    address = options.deriveAddress(index);
    const next = nextIndex(index, addressIndexStep);

    let used: boolean;
    try {
      used = await options.checker(address, options.signal);
    } catch (error) {
      assertNotAborted(options.signal);
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      if (next === EXHAUSTED_ADDRESS_INDEX) {
        throw new AddressSelectionExhaustedError();
      }
      return {
        address: options.deriveAddress(next),
        index: next,
        mode: "transient-fallback",
        nextStartIndex: next,
        uncheckedMode: false,
      };
    }

    assertNotAborted(options.signal);

    if (!used) {
      return {
        address,
        index,
        mode: "verified",
        nextStartIndex: index,
        uncheckedMode: false,
      };
    }
    if (next === EXHAUSTED_ADDRESS_INDEX || attempt + 1 === maxAttempts) {
      break;
    }
    index = next;
  }

  return {
    address,
    index,
    mode: "exhausted",
    nextStartIndex: nextIndex(index, addressIndexStep),
    uncheckedMode: true,
  };
};

export const createInitialSelectionState = (): SelectionState => ({
  startIndex: 0,
  uncheckedMode: false,
});
