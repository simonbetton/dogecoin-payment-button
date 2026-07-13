import type { MempoolWatchStatus } from "./mempool-watch";

export const watchStatusMessage = (
  status: MempoolWatchStatus,
  errorMessage: string | null
): string | null => {
  switch (status) {
    case "watching": {
      return "Waiting for payment in the mempool…";
    }
    case "appeared": {
      return "Payment detected in the mempool (not yet confirmed).";
    }
    case "timeout": {
      return "No matching payment appeared within 5 minutes.";
    }
    case "busy": {
      return "Another mempool watch session is already open. Try again shortly.";
    }
    case "error": {
      return errorMessage ?? "Unable to watch the mempool for this payment.";
    }
    default: {
      return null;
    }
  }
};

export const watchStatusClassName = (status: MempoolWatchStatus): string => {
  if (status === "appeared") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  }
  if (status === "watching") {
    return "border-border bg-muted/40 text-muted-foreground";
  }
  return "border-destructive/30 bg-destructive/5 text-destructive";
};
