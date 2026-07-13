"use client";

import { DogecoinPaymentButton } from "@/registry/default/dogecoin-payment-button";

import { fakeMempoolFetch, PREVIEW_DOGECOIN_ADDRESS } from "./preview-mempool";

export const PreviewPaymentButton = () => (
  <DogecoinPaymentButton
    address={PREVIEW_DOGECOIN_ADDRESS}
    amount="5"
    mempoolWatch={{
      endpoint: "/preview/mempool/watch",
      fetchImpl: fakeMempoolFetch,
    }}
  />
);
