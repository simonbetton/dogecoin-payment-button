"use client";

import { useEffect, useRef, useState } from "react";

type CopyStatus = "idle" | "pending" | "copied" | "error";

const FEEDBACK_DURATION_MS = 1600;

export const useCopyFeedback = (value: string) => {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const attempt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      attempt.current += 1;
      window.clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    attempt.current += 1;
    const { current } = attempt;
    window.clearTimeout(timer.current);
    setStatus("pending");

    let outcome: CopyStatus;
    try {
      await navigator.clipboard.writeText(value);
      outcome = "copied";
    } catch {
      outcome = "error";
    }

    if (attempt.current === current) {
      setStatus(outcome);
      timer.current = window.setTimeout(() => {
        setStatus("idle");
      }, FEEDBACK_DURATION_MS);
    }
  };

  return { copy, status };
};
