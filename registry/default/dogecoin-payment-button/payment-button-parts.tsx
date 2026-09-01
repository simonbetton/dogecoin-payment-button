"use client";

import { CheckIcon, CopyIcon, LoaderCircleIcon } from "lucide-react";
import * as React from "react";
import { renderSVG } from "uqr";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type {
  MempoolWatchAppearedPayload,
  MempoolWatchStatus,
} from "./mempool-watch";
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
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  const handleCopy = async () => {
    setCopied(true);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 1600);

    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // Keep the copied feedback even if the Clipboard API is unavailable.
    }
  };

  return (
    <Button
      aria-label={copied ? "Address copied" : "Copy address"}
      className="w-full"
      onClick={() => {
        void handleCopy();
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
          Copy address
        </span>
        <span
          aria-live="polite"
          className={cn(
            "col-start-1 row-start-1 transition-all duration-200",
            copied ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          )}
        >
          Copied
        </span>
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

const MempoolWatchBanner = ({
  appearedPayload,
  message,
  onRetry,
  status,
}: MempoolWatchBannerProps) => {
  const canRetry =
    status === "timeout" || status === "busy" || status === "error";

  return (
    <div
      aria-live="polite"
      className={cn(
        "rounded-lg border p-3 text-sm",
        watchStatusClassName(status)
      )}
    >
      <div className="flex items-start gap-2">
        {status === "watching" ? (
          <LoaderCircleIcon className="mt-0.5 size-4 shrink-0 animate-spin" />
        ) : null}
        {status === "appeared" ? (
          <CheckIcon className="mt-0.5 size-4 shrink-0" />
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

    <CopyAddressButton address={payment.address} />

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
        <Button
          className="mt-3"
          onClick={onRetryOpen}
          type="button"
          variant="outline"
        >
          Try again
        </Button>
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
