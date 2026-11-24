"use client";

import { CheckIcon, CircleAlertIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCopyFeedback } from "@/registry/default/dogecoin-payment-button/use-copy-feedback";

interface CopyButtonProps {
  className?: string;
  value: string;
}

const CopyButtonContent = ({ className, value }: CopyButtonProps) => {
  const { copy, status } = useCopyFeedback(value);
  const copied = status === "copied";
  const failed = status === "error";
  let label = "Copy code";
  if (copied) {
    label = "Copied";
  } else if (failed) {
    label = "Copy failed";
  }

  return (
    <>
      <Button
        aria-label={label}
        className={cn("size-7", className)}
        onClick={() => {
          void copy();
        }}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <span className="relative inline-flex size-3.5 items-center justify-center">
          {failed ? (
            <CircleAlertIcon aria-hidden="true" className="absolute size-3.5" />
          ) : null}
          <CopyIcon
            aria-hidden="true"
            className={cn(
              "absolute size-3.5 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
              copied || failed ? "scale-50 opacity-0" : "scale-100 opacity-100"
            )}
          />
          <CheckIcon
            aria-hidden="true"
            className={cn(
              "absolute size-3.5 text-emerald-600 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
              copied ? "scale-100 opacity-100" : "scale-50 opacity-0"
            )}
          />
        </span>
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
        />
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : null}
        {failed ? "Copy failed" : null}
      </span>
    </>
  );
};

export const CopyButton = (props: CopyButtonProps) => (
  <CopyButtonContent key={props.value} {...props} />
);
