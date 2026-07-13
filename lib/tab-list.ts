import type * as React from "react";

export const createTabListKeyDownHandler =
  <T extends string>({
    getTabElementId,
    onSelect,
    values,
    value,
  }: {
    getTabElementId: (value: T) => string;
    onSelect: (next: T) => void;
    value: T;
    values: readonly T[];
  }): ((event: React.KeyboardEvent<HTMLElement>) => void) =>
  (event) => {
    const currentIndex = values.indexOf(value);
    if (currentIndex === -1) {
      return;
    }

    let nextIndex = currentIndex;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown": {
        event.preventDefault();
        nextIndex = (currentIndex + 1) % values.length;
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        event.preventDefault();
        nextIndex = (currentIndex - 1 + values.length) % values.length;
        break;
      }
      case "Home": {
        event.preventDefault();
        nextIndex = 0;
        break;
      }
      case "End": {
        event.preventDefault();
        nextIndex = values.length - 1;
        break;
      }
      default: {
        return;
      }
    }

    const next = values[nextIndex];
    if (!next) {
      return;
    }

    onSelect(next);
    queueMicrotask(() => {
      const tab = document.querySelector<HTMLElement>(
        `#${CSS.escape(getTabElementId(next))}`
      );
      tab?.focus();
    });
  };
