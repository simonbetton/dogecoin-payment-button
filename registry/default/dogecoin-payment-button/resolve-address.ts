import type {
  AddressSelectionResult,
  AddressUsageChecker,
} from "./address-selection";
import { selectPaymentAddress } from "./address-selection";
import { defaultAddressUsageChecker } from "./blockcypher";
import { derivePaymentAddress } from "./dogecoin";

export interface ResolveDogecoinPaymentAddressOptions {
  addressIndexStep?: number;
  checker?: AddressUsageChecker;
  maxAttempts?: number;
  signal?: AbortSignal;
  startIndex?: number;
  uncheckedMode?: boolean;
  xpub: string;
}

/**
 * Resolve the next Payment Address for an account xpub.
 * Safe to call from a Next.js Server Action or the browser.
 */
export const resolveDogecoinPaymentAddress = (
  options: ResolveDogecoinPaymentAddressOptions
): Promise<AddressSelectionResult> =>
  selectPaymentAddress({
    addressIndexStep: options.addressIndexStep,
    checker: options.checker ?? defaultAddressUsageChecker,
    deriveAddress: (index) => derivePaymentAddress(options.xpub, index),
    maxAttempts: options.maxAttempts,
    signal: options.signal,
    startIndex: options.startIndex,
    uncheckedMode: options.uncheckedMode,
  });

export type {
  AddressSelectionResult,
  AddressUsageChecker,
  SelectionState,
} from "./address-selection";
export { createInitialSelectionState } from "./address-selection";
