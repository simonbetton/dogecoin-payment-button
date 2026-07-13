import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PREVIEW_DOGECOIN_ADDRESS,
  PREVIEW_MEMPOOL_DELAY_MS,
} from "./preview-mempool";
import { PreviewPaymentButton } from "./preview-payment-button";

describe(PreviewPaymentButton, () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("waits three seconds before simulating a mempool payment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      pointerEventsCheck: 0,
    });

    render(<PreviewPaymentButton />);

    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText(PREVIEW_DOGECOIN_ADDRESS)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Waiting for payment in the mempool/u)
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREVIEW_MEMPOOL_DELAY_MS);
    });

    await waitFor(() => {
      expect(
        within(dialog).getByText(/Payment detected in the mempool/u)
      ).toBeInTheDocument();
    });
  });
});
