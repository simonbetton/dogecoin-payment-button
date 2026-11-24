"use client";

import * as React from "react";

import type {
  AddressSelectionResult,
  AddressUsageChecker,
  SelectionState,
} from "./address-selection";
import {
  createInitialSelectionState,
  isSelectionState,
} from "./address-selection";
import { isDogecoinP2pkhAddress } from "./dogecoin";
import type {
  MempoolWatchAppearedPayload,
  MempoolWatchStatus,
} from "./mempool-watch";
import { dogeAmountToBaseUnits, watchMempoolPayment } from "./mempool-watch";
import type { ResolvedPayment } from "./payment-button-parts";
import type { DogecoinPaymentResolveFn } from "./payment-button-types";
import { buildDogecoinPaymentUri } from "./payment-uri";
import { resolveDogecoinPaymentAddress } from "./resolve-address";

type ResolutionStatus = "idle" | "loading" | "error";

type ResolutionOutcome =
  | { status: "ready"; address: string; unchecked: boolean }
  | { status: "error"; errorMessage: string };

interface ResolutionSnapshot {
  outcome: ResolutionOutcome;
  request: object;
}

type WatchOutcome =
  | { status: "watching" | "busy" | "timeout" }
  | { status: "appeared"; payload: MempoolWatchAppearedPayload }
  | { status: "error"; message: string };

interface WatchSnapshot {
  outcome: WatchOutcome;
  request: object;
}

// Async completions must see the latest committed inputs, including during
// the interval before the previous passive effect has cleaned up.
const useCommittedRef = <T>(value: T) => {
  const ref = React.useRef<T | null>(null);
  React.useLayoutEffect(() => {
    ref.current = value;
    return () => {
      ref.current = null;
    };
  }, [value]);
  return ref;
};

export interface UsePaymentResolutionOptions {
  address?: string;
  addressIndexStep?: number;
  amount?: string;
  checker?: AddressUsageChecker;
  maxAttempts?: number;
  open: boolean;
  resolveAddress?: DogecoinPaymentResolveFn;
  xpub?: string;
}

const resolvePayment = async (
  options: UsePaymentResolutionOptions,
  selection: SelectionState,
  signal: AbortSignal
): Promise<AddressSelectionResult> => {
  if (options.resolveAddress) {
    return await options.resolveAddress(selection);
  }
  if (options.xpub) {
    return await resolveDogecoinPaymentAddress({
      addressIndexStep: options.addressIndexStep,
      checker: options.checker,
      maxAttempts: options.maxAttempts,
      signal,
      startIndex: selection.startIndex,
      uncheckedMode: selection.uncheckedMode,
      xpub: options.xpub,
    });
  }
  throw new Error("No payment address source configured.");
};

const validateResolution = (result: AddressSelectionResult) => {
  if (!isDogecoinP2pkhAddress(result.address)) {
    throw new Error("The resolver returned an invalid Dogecoin address.");
  }

  const selection = {
    startIndex: result.nextStartIndex,
    uncheckedMode: result.uncheckedMode,
  };
  if (!isSelectionState(selection)) {
    throw new Error(
      "The resolver returned an invalid address selection cursor."
    );
  }
  return selection;
};

export const usePaymentResolution = ({
  address: staticAddress,
  addressIndexStep,
  amount,
  checker,
  maxAttempts,
  open,
  resolveAddress,
  xpub,
}: UsePaymentResolutionOptions) => {
  const [snapshot, setSnapshot] = React.useState<ResolutionSnapshot>();
  const [attempt, retryResolution] = React.useReducer(
    (count: number) => count + 1,
    0
  );
  const selectionRef = React.useRef({
    selection: createInitialSelectionState(),
    xpub,
  });
  const request = React.useMemo(
    () => ({
      addressIndexStep,
      attempt,
      checker,
      maxAttempts,
      open,
      resolveAddress,
      staticAddress,
      xpub,
    }),
    [
      addressIndexStep,
      attempt,
      checker,
      maxAttempts,
      open,
      resolveAddress,
      staticAddress,
      xpub,
    ]
  );

  const activeRequest = useCommittedRef(request);

  React.useEffect(() => {
    if (selectionRef.current.xpub !== request.xpub) {
      selectionRef.current = {
        selection: createInitialSelectionState(),
        xpub: request.xpub,
      };
    }
    if (!request.open || request.staticAddress) {
      return;
    }

    const controller = new AbortController();
    let ignore = false;
    const selection = { ...selectionRef.current.selection };

    void (async () => {
      try {
        const result = await resolvePayment(
          request,
          selection,
          controller.signal
        );
        if (ignore) {
          return;
        }
        if (activeRequest.current !== request) {
          return;
        }

        selectionRef.current = {
          selection: validateResolution(result),
          xpub: request.xpub,
        };
        setSnapshot({
          outcome: {
            address: result.address,
            status: "ready",
            unchecked: result.uncheckedMode,
          },
          request,
        });
      } catch (error: unknown) {
        if (ignore) {
          return;
        }
        if (activeRequest.current !== request) {
          return;
        }
        setSnapshot({
          outcome: {
            errorMessage:
              error instanceof Error || error instanceof DOMException
                ? error.message
                : "Unable to resolve a Dogecoin payment address.",
            status: "error",
          },
          request,
        });
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [activeRequest, request]);

  let status: ResolutionStatus = open ? "loading" : "idle";
  let payment: ResolvedPayment | null = null;
  let errorMessage: string | null = null;
  let canWatch = false;
  let outcome: ResolutionOutcome | undefined;
  if (open && staticAddress) {
    outcome = { address: staticAddress, status: "ready", unchecked: false };
  } else if (open && snapshot?.request === request) {
    ({ outcome } = snapshot);
  }

  if (outcome?.status === "error") {
    status = "error";
    ({ errorMessage } = outcome);
  } else if (outcome?.status === "ready") {
    try {
      payment = {
        address: outcome.address,
        uri: buildDogecoinPaymentUri(outcome.address, amount),
      };
      status = "idle";
      canWatch = !outcome.unchecked;
    } catch (error: unknown) {
      status = "error";
      errorMessage =
        error instanceof Error ? error.message : "Invalid payment details.";
    }
  }

  return {
    canRetryResolution: outcome?.status === "error",
    canWatch,
    errorMessage,
    payment,
    retryResolution,
    status,
  };
};

export interface UseMempoolWatchOptions {
  amount?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  onPaymentAppeared?: (payload: MempoolWatchAppearedPayload) => void;
  open: boolean;
  paymentAddress?: string;
}

export const useMempoolWatch = ({
  amount,
  endpoint,
  fetchImpl,
  onPaymentAppeared,
  open,
  paymentAddress,
}: UseMempoolWatchOptions) => {
  const [snapshot, setSnapshot] = React.useState<WatchSnapshot>();
  const [attempt, retryWatch] = React.useReducer(
    (count: number) => count + 1,
    0
  );
  const request = React.useMemo(
    () => ({ amount, attempt, endpoint, fetchImpl, open, paymentAddress }),
    [amount, attempt, endpoint, fetchImpl, open, paymentAddress]
  );
  const activeRequest = useCommittedRef(request);
  const appearedCallback = useCommittedRef(onPaymentAppeared);

  React.useEffect(() => {
    if (!request.open || !request.endpoint || !request.paymentAddress) {
      return;
    }

    const publish = (outcome: WatchOutcome) => {
      if (activeRequest.current === request) {
        setSnapshot({ outcome, request });
        if (outcome.status === "appeared") {
          appearedCallback.current?.(outcome.payload);
        }
      }
    };
    try {
      const minValueBase = request.amount
        ? dogeAmountToBaseUnits(request.amount)
        : undefined;
      publish({ status: "watching" });
      const handle = watchMempoolPayment({
        address: request.paymentAddress,
        endpoint: request.endpoint,
        fetchImpl: request.fetchImpl,
        minValueBase,
        onAppeared: (payload) => {
          publish({ payload, status: "appeared" });
        },
        onBusy: () => {
          publish({ status: "busy" });
        },
        onError: (error) => {
          publish({ message: error.message, status: "error" });
        },
        onTimeout: () => {
          publish({ status: "timeout" });
        },
      });
      return handle.close;
    } catch (error: unknown) {
      publish({
        message:
          error instanceof Error
            ? error.message
            : "Unable to start a mempool watch.",
        status: "error",
      });
    }
  }, [activeRequest, appearedCallback, request]);

  const outcome = snapshot?.request === request ? snapshot.outcome : null;
  const status: MempoolWatchStatus = outcome?.status ?? "idle";
  return {
    appearedPayload: outcome?.status === "appeared" ? outcome.payload : null,
    errorMessage: outcome?.status === "error" ? outcome.message : null,
    retryWatch,
    status,
  };
};
