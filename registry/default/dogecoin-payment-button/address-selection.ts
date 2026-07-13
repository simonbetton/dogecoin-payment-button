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

  if (!Number.isInteger(addressIndexStep) || addressIndexStep < 1) {
    throw new Error("addressIndexStep must be a positive integer.");
  }

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer.");
  }

  if (!Number.isInteger(startIndex) || startIndex < 0) {
    throw new Error("startIndex must be a non-negative integer.");
  }

  assertNotAborted(options.signal);

  if (uncheckedMode) {
    const address = options.deriveAddress(startIndex);
    return {
      address,
      index: startIndex,
      mode: "unchecked",
      nextStartIndex: startIndex + addressIndexStep,
      uncheckedMode: true,
    };
  }

  let lastCheckedIndex = startIndex;
  let lastCheckedAddress = options.deriveAddress(startIndex);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    assertNotAborted(options.signal);

    const index = startIndex + attempt * addressIndexStep;
    const address =
      attempt === 0 ? lastCheckedAddress : options.deriveAddress(index);
    lastCheckedIndex = index;
    lastCheckedAddress = address;

    let used: boolean;
    try {
      used = await options.checker(address, options.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      const fallbackIndex = index + addressIndexStep;
      return {
        address: options.deriveAddress(fallbackIndex),
        index: fallbackIndex,
        mode: "transient-fallback",
        nextStartIndex: fallbackIndex,
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
  }

  return {
    address: lastCheckedAddress,
    index: lastCheckedIndex,
    mode: "exhausted",
    nextStartIndex: lastCheckedIndex + addressIndexStep,
    uncheckedMode: true,
  };
};

export const createInitialSelectionState = (): SelectionState => ({
  startIndex: 0,
  uncheckedMode: false,
});
