"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { isDogecoinP2pkhAddress } from "./dogecoin";
import { PaymentDialogBody } from "./payment-button-parts";
import type { DogecoinPaymentButtonProps } from "./payment-button-types";
import {
  useMempoolWatch,
  usePaymentResolution,
} from "./use-payment-button-state";
import { watchStatusMessage } from "./watch-status";

export type {
  DogecoinPaymentButtonProps,
  DogecoinPaymentResolveFn,
  MempoolWatchConfig,
} from "./payment-button-types";

const countModes = ({
  address,
  resolveAddress,
  xpub,
}: DogecoinPaymentButtonProps): number =>
  [address, resolveAddress, xpub].filter(Boolean).length;

export const DogecoinPaymentButton = (props: DogecoinPaymentButtonProps) => {
  if (countModes(props) !== 1) {
    throw new Error(
      "DogecoinPaymentButton requires exactly one of `address`, `resolveAddress`, or `xpub`."
    );
  }

  if (props.address && !isDogecoinP2pkhAddress(props.address)) {
    throw new Error(
      "DogecoinPaymentButton received an invalid Dogecoin address."
    );
  }

  const [open, setOpen] = React.useState(false);
  const {
    address: staticAddress,
    addressIndexStep,
    amount,
    buttonLabel,
    checker,
    children,
    className,
    maxAttempts,
    mempoolWatch,
    resolveAddress,
    xpub,
  } = props;

  const resolution = usePaymentResolution({
    address: staticAddress,
    addressIndexStep,
    amount,
    checker,
    maxAttempts,
    open,
    resolveAddress,
    xpub,
  });

  const watch = useMempoolWatch({
    amount,
    endpoint: mempoolWatch?.endpoint,
    fetchImpl: mempoolWatch?.fetchImpl,
    onPaymentAppeared: props.onPaymentAppeared,
    open,
    paymentAddress: resolution.payment?.address,
    resolutionStatus: resolution.status,
  });

  const watchMessage = watchStatusMessage(watch.status, watch.errorMessage);

  const handleRetryOpen = () => {
    setOpen(false);
    queueMicrotask(() => {
      setOpen(true);
    });
  };

  const handleRetryWatch = () => {
    watch.retryWatch();
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(className)}
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        {children ?? buttonLabel ?? "Send me Dogecoin"}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send me Dogecoin</DialogTitle>
          <DialogDescription>
            Scan the QR code or copy the address below to send DOGE.
          </DialogDescription>
        </DialogHeader>

        <PaymentDialogBody
          amount={amount}
          appearedPayload={watch.appearedPayload}
          errorMessage={resolution.errorMessage}
          mempoolWatchEnabled={Boolean(mempoolWatch)}
          onRetryOpen={handleRetryOpen}
          onRetryWatch={handleRetryWatch}
          payment={resolution.payment}
          status={resolution.status}
          watchMessage={watchMessage}
          watchStatus={watch.status}
        />
      </DialogContent>
    </Dialog>
  );
};
