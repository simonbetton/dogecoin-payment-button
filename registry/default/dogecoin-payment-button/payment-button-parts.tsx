"use client";

import {
  CheckIcon,
  CircleAlertIcon,
  CopyIcon,
  LoaderCircleIcon,
} from "lucide-react";
import * as React from "react";
import { renderSVG } from "uqr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type {
  MempoolWatchAppearedPayload,
  MempoolWatchStatus,
} from "./mempool-watch";
import { useCopyFeedback } from "./use-copy-feedback";
import { watchStatusClassName } from "./watch-status";

export interface ResolvedPayment {
  address: string;
  uri: string;
}

interface DogecoinQrCodeProps {
  value: string;
}

const DogecoinQrCode = ({ value }: DogecoinQrCodeProps) => {
  const svg = React.useMemo(() => renderSVG(value, { border: 2 }), [value]);

  return (
    <div
      aria-hidden="true"
      className="mx-auto size-48 overflow-hidden rounded-lg bg-white p-2 text-black [&_svg]:size-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

interface CopyAddressButtonProps {
  address: string;
}

const CopyAddressButton = ({ address }: CopyAddressButtonProps) => {
  const { copy, status } = useCopyFeedback(address);
  const copied = status === "copied";
  const failed = status === "error";
  let label = "Copy address";
  if (copied) {
    label = "Address copied";
  } else if (failed) {
    label = "Copy failed";
  }

  return (
    <Button
      aria-label={label}
      className="w-full"
      onClick={() => {
        void copy();
      }}
      type="button"
      variant="outline"
    >
      <span className="relative inline-flex size-4 items-center justify-center">
        <CopyIcon
          className={cn(
            "absolute size-4 transition-all duration-200",
            copied ? "scale-50 opacity-0" : "scale-100 opacity-100"
          )}
        />
        <CheckIcon
          className={cn(
            "absolute size-4 text-emerald-600 transition-all duration-200",
            copied ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
        />
      </span>
      <span className="relative inline-grid overflow-hidden">
        <span
          className={cn(
            "col-start-1 row-start-1 transition-all duration-200",
            copied ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
          )}
        >
          {failed ? "Copy failed" : "Copy address"}
        </span>
        <span
          className={cn(
            "col-start-1 row-start-1 transition-all duration-200",
            copied ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          )}
        >
          Copied
        </span>
      </span>
      <span aria-live="polite" className="sr-only">
        {copied || failed ? label : null}
      </span>
    </Button>
  );
};

interface MempoolWatchBannerProps {
  appearedPayload: MempoolWatchAppearedPayload | null;
  message: string;
  onRetry: () => void;
  status: MempoolWatchStatus;
}

const isWatchFailure = (status: MempoolWatchStatus): boolean =>
  status === "timeout" || status === "busy" || status === "error";

const MempoolWatchBanner = ({
  appearedPayload,
  message,
  onRetry,
  status,
}: MempoolWatchBannerProps) => {
  const canRetry = isWatchFailure(status);
  const isSuccess = status === "appeared";

  return (
    <div
      aria-live="polite"
      className={cn(
        "origin-center rounded-lg border p-3 text-sm",
        watchStatusClassName(status),
        isSuccess && "animate-mempool-success",
        canRetry && "animate-mempool-failure"
      )}
      data-watch-status={status}
    >
      <div className="flex items-start gap-2">
        {status === "watching" ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 animate-spin"
          />
        ) : null}
        {isSuccess ? (
          <CheckIcon
            aria-hidden="true"
            className="animate-mempool-icon mt-0.5 size-4 shrink-0"
          />
        ) : null}
        {canRetry ? (
          <CircleAlertIcon
            aria-hidden="true"
            className="animate-mempool-icon mt-0.5 size-4 shrink-0"
          />
        ) : null}
        <div className="space-y-1">
          <p>{message}</p>
          {appearedPayload ? (
            <p className="font-mono text-xs break-all opacity-80">
              txid: {appearedPayload.txid}
            </p>
          ) : null}
        </div>
      </div>

      {canRetry ? (
        <Button
          className="mt-3"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          Watch again
        </Button>
      ) : null}
    </div>
  );
};

interface PaymentDetailsProps {
  amount?: string;
  appearedPayload: MempoolWatchAppearedPayload | null;
  payment: ResolvedPayment;
  watchMessage: string | null;
  watchStatus: MempoolWatchStatus;
  onRetryWatch: () => void;
}

const PaymentDetails = ({
  amount,
  appearedPayload,
  payment,
  watchMessage,
  watchStatus,
  onRetryWatch,
}: PaymentDetailsProps) => (
  <>
    {amount ? (
      <p className="text-muted-foreground text-center text-sm">
        Suggested amount:{" "}
        <span className="text-foreground font-medium">{amount} DOGE</span>
      </p>
    ) : null}

    <DogecoinQrCode value={payment.uri} />

    <div className="bg-muted/40 rounded-lg border px-3 py-2">
      <p className="font-mono text-xs leading-relaxed break-all">
        {payment.address}
      </p>
    </div>

    <CopyAddressButton address={payment.address} key={payment.address} />

    {watchMessage ? (
      <MempoolWatchBanner
        appearedPayload={appearedPayload}
        message={watchMessage}
        onRetry={onRetryWatch}
        status={watchStatus}
      />
    ) : null}
  </>
);

export interface PaymentDialogBodyProps {
  amount?: string;
  appearedPayload: MempoolWatchAppearedPayload | null;
  canRetryResolution: boolean;
  errorMessage: string | null;
  mempoolWatchEnabled: boolean;
  payment: ResolvedPayment | null;
  status: "idle" | "loading" | "error";
  watchMessage: string | null;
  watchStatus: MempoolWatchStatus;
  onRetryOpen: () => void;
  onRetryWatch: () => void;
}

export const PaymentDialogBody = ({
  amount,
  appearedPayload,
  canRetryResolution,
  errorMessage,
  mempoolWatchEnabled,
  payment,
  status,
  watchMessage,
  watchStatus,
  onRetryOpen,
  onRetryWatch,
}: PaymentDialogBodyProps) => (
  <div className="flex flex-col gap-4">
    {status === "loading" ? (
      <div className="text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-3">
        <LoaderCircleIcon className="size-6 animate-spin" />
        <p>Finding a payment address…</p>
      </div>
    ) : null}

    {status === "error" ? (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-4 text-sm">
        <p>{errorMessage ?? "Something went wrong."}</p>
        {canRetryResolution ? (
          <Button
            className="mt-3"
            onClick={onRetryOpen}
            type="button"
            variant="outline"
          >
            Try again
          </Button>
        ) : null}
      </div>
    ) : null}

    {status === "idle" && payment ? (
      <PaymentDetails
        amount={amount}
        appearedPayload={appearedPayload}
        onRetryWatch={onRetryWatch}
        payment={payment}
        watchMessage={mempoolWatchEnabled ? watchMessage : null}
        watchStatus={watchStatus}
      />
    ) : null}
  </div>
);
