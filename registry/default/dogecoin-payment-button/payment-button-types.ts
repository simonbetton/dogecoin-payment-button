import type { ReactNode } from "react";

import type {
  AddressSelectionResult,
  AddressUsageChecker,
  SelectionState,
} from "./address-selection";
import type { MempoolWatchAppearedPayload } from "./mempool-watch";

export type DogecoinPaymentResolveFn = (
  state: SelectionState
) => Promise<AddressSelectionResult>;

export interface MempoolWatchConfig {
  /** Same-origin or absolute SSE proxy endpoint. */
  endpoint: string;
  /**
   * Optional fetch implementation for tests. Defaults to global fetch.
   */
  fetchImpl?: typeof fetch;
}

interface SharedProps {
  amount?: string;
  buttonLabel?: string;
  children?: ReactNode;
  className?: string;
  mempoolWatch?: MempoolWatchConfig;
  onPaymentAppeared?: (payload: MempoolWatchAppearedPayload) => void;
}

export interface AddressModeProps extends SharedProps {
  address: string;
  addressIndexStep?: never;
  checker?: never;
  maxAttempts?: never;
  resolveAddress?: never;
  xpub?: never;
}

export interface ServerModeProps extends SharedProps {
  address?: never;
  addressIndexStep?: never;
  checker?: never;
  maxAttempts?: never;
  resolveAddress: DogecoinPaymentResolveFn;
  xpub?: never;
}

export interface BrowserModeProps extends SharedProps {
  address?: never;
  addressIndexStep?: number;
  checker?: AddressUsageChecker;
  maxAttempts?: number;
  resolveAddress?: never;
  xpub: string;
}

export type DogecoinPaymentButtonProps =
  | AddressModeProps
  | ServerModeProps
  | BrowserModeProps;
