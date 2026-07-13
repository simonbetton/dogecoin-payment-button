"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  className?: string;
  value: string;
}

export const CopyButton = ({ className, value }: CopyButtonProps) => {
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
      await navigator.clipboard.writeText(value);
    } catch {
      // Keep the copied feedback even if the Clipboard API is unavailable.
    }
  };

  return (
    <>
      <Button
        aria-label={copied ? "Copied" : "Copy code"}
        className={cn("size-7", className)}
        onClick={() => {
          void handleCopy();
        }}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <span className="relative inline-flex size-3.5 items-center justify-center">
          <CopyIcon
            aria-hidden="true"
            className={cn(
              "absolute size-3.5 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
              copied ? "scale-50 opacity-0" : "scale-100 opacity-100"
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
          className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2"
        />
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
};
