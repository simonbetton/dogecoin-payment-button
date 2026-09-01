"use client";

import * as React from "react";

import type {
  AddressSelectionResult,
  AddressUsageChecker,
  SelectionState,
} from "./address-selection";
import { createInitialSelectionState } from "./address-selection";
import type {
  MempoolWatchAppearedPayload,
  MempoolWatchStatus,
  WatchMempoolHandle,
} from "./mempool-watch";
import { dogeAmountToBaseUnits, watchMempoolPayment } from "./mempool-watch";
import type { ResolvedPayment } from "./payment-button-parts";
import type { DogecoinPaymentResolveFn } from "./payment-button-types";
import { buildDogecoinPaymentUri } from "./payment-uri";
import { resolveDogecoinPaymentAddress } from "./resolve-address";

type ResolutionStatus = "idle" | "loading" | "error";

interface ResolutionState {
  errorMessage: string | null;
  payment: ResolvedPayment | null;
  selectionState: SelectionState;
  status: ResolutionStatus;
}

type ResolutionAction =
  | { type: "static-ready"; payment: ResolvedPayment }
  | { type: "resolve-start" }
  | {
      type: "resolve-success";
      payment: ResolvedPayment;
      selectionState: SelectionState;
    }
  | { type: "resolve-error"; message: string };

const createInitialResolutionState = (
  staticAddress: string | undefined,
  amount: string | undefined
): ResolutionState => ({
  errorMessage: null,
  payment: staticAddress
    ? {
        address: staticAddress,
        uri: buildDogecoinPaymentUri(staticAddress, amount),
      }
    : null,
  selectionState: createInitialSelectionState(),
  status: "idle",
});

const resolutionReducer = (
  state: ResolutionState,
  action: ResolutionAction
): ResolutionState => {
  switch (action.type) {
    case "static-ready": {
      return {
        ...state,
        errorMessage: null,
        payment: action.payment,
        status: "idle",
      };
    }
    case "resolve-start": {
      return {
        ...state,
        errorMessage: null,
        status: "loading",
      };
    }
    case "resolve-success": {
      return {
        ...state,
        errorMessage: null,
        payment: action.payment,
        selectionState: action.selectionState,
        status: "idle",
      };
    }
    case "resolve-error": {
      return {
        ...state,
        errorMessage: action.message,
        status: "error",
      };
    }
    default: {
      return state;
    }
  }
};

interface WatchState {
  appearedPayload: MempoolWatchAppearedPayload | null;
  errorMessage: string | null;
  session: number;
  status: MempoolWatchStatus;
}

type WatchAction =
  | { type: "reset" }
  | { type: "start" }
  | { type: "amount-error"; message: string }
  | { type: "appeared"; payload: MempoolWatchAppearedPayload }
  | { type: "busy" }
  | { type: "error"; message: string }
  | { type: "timeout" }
  | { type: "retry" };

const initialWatchState: WatchState = {
  appearedPayload: null,
  errorMessage: null,
  session: 0,
  status: "idle",
};

const watchReducer = (state: WatchState, action: WatchAction): WatchState => {
  switch (action.type) {
    case "reset": {
      return {
        ...state,
        appearedPayload: null,
        errorMessage: null,
        status: "idle",
      };
    }
    case "start": {
      return {
        ...state,
        appearedPayload: null,
        errorMessage: null,
        status: "watching",
      };
    }
    case "amount-error": {
      return {
        ...state,
        errorMessage: action.message,
        status: "error",
      };
    }
    case "appeared": {
      return {
        ...state,
        appearedPayload: action.payload,
        status: "appeared",
      };
    }
    case "busy": {
      return {
        ...state,
        status: "busy",
      };
    }
    case "error": {
      return {
        ...state,
        errorMessage: action.message,
        status: "error",
      };
    }
    case "timeout": {
      return {
        ...state,
        status: "timeout",
      };
    }
    case "retry": {
      return {
        appearedPayload: null,
        errorMessage: null,
        session: state.session + 1,
        status: "idle",
      };
    }
    default: {
      return state;
    }
  }
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
  const [state, dispatch] = React.useReducer(resolutionReducer, undefined, () =>
    createInitialResolutionState(staticAddress, amount)
  );
  const requestIdRef = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const selectionStateRef = React.useRef(state.selectionState);

  React.useEffect(() => {
    selectionStateRef.current = state.selectionState;
  }, [state.selectionState]);

  const runResolution = React.useCallback(
    async (
      selection: SelectionState,
      signal: AbortSignal,
      requestId: number
    ) => {
      let result: AddressSelectionResult;

      if (resolveAddress) {
        result = await resolveAddress(selection);
      } else if (xpub) {
        result = await resolveDogecoinPaymentAddress({
          addressIndexStep,
          checker,
          maxAttempts,
          signal,
          startIndex: selection.startIndex,
          uncheckedMode: selection.uncheckedMode,
          xpub,
        });
      } else {
        throw new Error("No payment address source configured.");
      }

      if (requestId !== requestIdRef.current || signal.aborted) {
        return;
      }

      dispatch({
        payment: {
          address: result.address,
          uri: buildDogecoinPaymentUri(result.address, amount),
        },
        selectionState: {
          startIndex: result.nextStartIndex,
          uncheckedMode: result.uncheckedMode,
        },
        type: "resolve-success",
      });
    },
    [amount, addressIndexStep, checker, maxAttempts, resolveAddress, xpub]
  );

  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    if (staticAddress) {
      const nextUri = buildDogecoinPaymentUri(staticAddress, amount);
      dispatch({
        payment: {
          address: staticAddress,
          uri: nextUri,
        },
        type: "static-ready",
      });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    abortRef.current = controller;
    const stateSnapshot = selectionStateRef.current;

    dispatch({ type: "resolve-start" });

    void (async () => {
      try {
        await runResolution(stateSnapshot, controller.signal, requestId);
      } catch (error: unknown) {
        if (
          controller.signal.aborted ||
          requestId !== requestIdRef.current ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        dispatch({
          message:
            error instanceof Error
              ? error.message
              : "Unable to resolve a Dogecoin payment address.",
          type: "resolve-error",
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [amount, open, runResolution, staticAddress]);

  return state;
};

export interface UseMempoolWatchOptions {
  amount?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  onPaymentAppeared?: (payload: MempoolWatchAppearedPayload) => void;
  open: boolean;
  paymentAddress?: string;
  resolutionStatus: ResolutionStatus;
}

export const useMempoolWatch = ({
  amount,
  endpoint,
  fetchImpl,
  onPaymentAppeared,
  open,
  paymentAddress,
  resolutionStatus,
}: UseMempoolWatchOptions) => {
  const [state, dispatch] = React.useReducer(watchReducer, initialWatchState);
  const watchHandleRef = React.useRef<WatchMempoolHandle | null>(null);
  const appearedCallbackRef = React.useRef(onPaymentAppeared);

  React.useEffect(() => {
    appearedCallbackRef.current = onPaymentAppeared;
  }, [onPaymentAppeared]);

  React.useEffect(() => {
    watchHandleRef.current?.close();
    watchHandleRef.current = null;

    if (!open) {
      dispatch({ type: "reset" });
      return;
    }

    if (!endpoint || !paymentAddress || resolutionStatus !== "idle") {
      return;
    }

    let minValueBase: string | undefined;
    if (amount) {
      try {
        minValueBase = dogeAmountToBaseUnits(amount);
      } catch (error: unknown) {
        dispatch({
          message:
            error instanceof Error
              ? error.message
              : "Unable to convert the suggested amount to base units.",
          type: "amount-error",
        });
        return;
      }
    }

    let active = true;
    dispatch({ type: "start" });

    const controller = new AbortController();
    const handle = watchMempoolPayment({
      address: paymentAddress,
      endpoint,
      fetchImpl,
      minValueBase,
      onAppeared: (payload) => {
        if (!active) {
          return;
        }
        dispatch({ payload, type: "appeared" });
        appearedCallbackRef.current?.(payload);
      },
      onBusy: () => {
        if (!active) {
          return;
        }
        dispatch({ type: "busy" });
      },
      onError: (error) => {
        if (!active) {
          return;
        }
        dispatch({ message: error.message, type: "error" });
      },
      onTimeout: () => {
        if (!active) {
          return;
        }
        dispatch({ type: "timeout" });
      },
      signal: controller.signal,
    });
    watchHandleRef.current = handle;

    return () => {
      active = false;
      controller.abort();
      handle.close();
      if (watchHandleRef.current === handle) {
        watchHandleRef.current = null;
      }
    };
  }, [
    amount,
    endpoint,
    fetchImpl,
    open,
    paymentAddress,
    resolutionStatus,
    // Retry increments session so this effect remounts the watch.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- retry token
    state.session,
  ]);

  const retryWatch = () => {
    dispatch({ type: "retry" });
  };

  return {
    appearedPayload: state.appearedPayload,
    errorMessage: state.errorMessage,
    retryWatch,
    status: state.status,
  };
};
