"use client";

import { DogecoinPaymentButton } from "@/registry/default/dogecoin-payment-button";
import type {
  AddressSelectionResult,
  DogecoinPaymentResolveFn,
  MempoolWatchConfig,
  SelectionState,
} from "@/registry/default/dogecoin-payment-button";

const RESOLVE_ADDRESS_ENDPOINT = "/api/dogecoin/resolve-address";

const resolvePaymentAddress: DogecoinPaymentResolveFn = async (
  state: SelectionState
): Promise<AddressSelectionResult> => {
  const response = await fetch(RESOLVE_ADDRESS_ENDPOINT, {
    body: JSON.stringify(state),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    let message = "Unable to resolve a Dogecoin payment address.";
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === "string" && payload.error.length > 0) {
        message = payload.error;
      }
    } catch {
      // Keep the generic message when the error body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as AddressSelectionResult;
};

interface LivePaymentButtonProps {
  amount?: string;
  mempoolWatch?: MempoolWatchConfig;
}

export const LivePaymentButton = ({
  amount,
  mempoolWatch,
}: LivePaymentButtonProps) => (
  <DogecoinPaymentButton
    amount={amount}
    mempoolWatch={mempoolWatch}
    resolveAddress={resolvePaymentAddress}
  />
);
