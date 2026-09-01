import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DogecoinPaymentButton } from "./dogecoin-payment-button";
import type { DogecoinPaymentResolveFn } from "./dogecoin-payment-button";
import type { MempoolWatchAppearedPayload } from "./mempool-watch";

const ADDRESS = "DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B";
const ADDRESS_19 = "DCzqVvn9NB1QuqBAmvKwvsKA4YXmsZhVir";

const encodeSse = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const createStreamResponse = (chunks: string[]): Response => {
  const encoder = new TextEncoder();
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
    status: 200,
  });
};

describe(DogecoinPaymentButton, () => {
  const writeText = vi.fn<(data: string) => Promise<void>>(() =>
    Promise.resolve()
  );

  beforeEach(() => {
    writeText.mockClear();
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: {
        writeText,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens a modal with QR, address, and copy feedback for a static address", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(
      <DogecoinPaymentButton address={ADDRESS} amount="8.25">
        Pay with DOGE
      </DogecoinPaymentButton>
    );

    await user.click(screen.getByRole("button", { name: "Pay with DOGE" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Send me Dogecoin")).toBeInTheDocument();
    expect(within(dialog).getByText(/8\.25 DOGE/u)).toBeInTheDocument();
    expect(within(dialog).getByText(ADDRESS)).toBeInTheDocument();
    expect(dialog.querySelector("svg")).toBeTruthy();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Copy address" })
    );

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Address copied" })
      ).toBeInTheDocument();
      expect(within(dialog).getByText("Copied")).toBeInTheDocument();
    });
  });

  it("resolves through a Server Action on each open and remembers the next index", async () => {
    const user = userEvent.setup();
    const resolveAddress = vi
      .fn<DogecoinPaymentResolveFn>()
      .mockResolvedValueOnce({
        address: ADDRESS,
        index: 0,
        mode: "verified",
        nextStartIndex: 0,
        uncheckedMode: false,
      })
      .mockResolvedValueOnce({
        address: ADDRESS_19,
        index: 19,
        mode: "verified",
        nextStartIndex: 19,
        uncheckedMode: false,
      });

    render(
      <DogecoinPaymentButton resolveAddress={resolveAddress}>
        Donate
      </DogecoinPaymentButton>
    );

    await user.click(screen.getByRole("button", { name: "Donate" }));
    let dialog = await screen.findByRole("dialog");
    await expect(
      within(dialog).findByText(ADDRESS)
    ).resolves.toBeInTheDocument();
    expect(resolveAddress).toHaveBeenCalledWith({
      startIndex: 0,
      uncheckedMode: false,
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Donate" }));
    dialog = await screen.findByRole("dialog");
    await expect(
      within(dialog).findByText(ADDRESS_19)
    ).resolves.toBeInTheDocument();
    expect(resolveAddress).toHaveBeenLastCalledWith({
      startIndex: 0,
      uncheckedMode: false,
    });
  });

  it("shows an error state when resolution fails", async () => {
    const user = userEvent.setup();
    const resolveAddress = vi.fn<DogecoinPaymentResolveFn>(() =>
      Promise.reject(new Error("Backend unavailable"))
    );

    render(<DogecoinPaymentButton resolveAddress={resolveAddress} />);

    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    const dialog = await screen.findByRole("dialog");
    await expect(
      within(dialog).findByText("Backend unavailable")
    ).resolves.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  it("starts a mempool watch and shows detected state with a single callback", async () => {
    const user = userEvent.setup();
    const onPaymentAppeared =
      vi.fn<(payload: MempoolWatchAppearedPayload) => void>();
    const appeared: MempoolWatchAppearedPayload = {
      address: ADDRESS,
      detectedAt: "2026-07-13T01:00:00.000Z",
      outputs: [{ valueBase: "1000000000", vout: 0 }],
      source: "live",
      txid: "txid-123",
    };
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        createStreamResponse([encodeSse("mempool.watch.appeared", appeared)])
      )
    );

    render(
      <DogecoinPaymentButton
        address={ADDRESS}
        amount="10"
        mempoolWatch={{
          endpoint: "/api/dogecoin/mempool/watch",
          fetchImpl,
        }}
        onPaymentAppeared={onPaymentAppeared}
      />
    );

    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    const dialog = await screen.findByRole("dialog");

    await expect(
      within(dialog).findByText(/Payment detected in the mempool/u)
    ).resolves.toBeInTheDocument();
    expect(within(dialog).getByText(/txid: txid-123/u)).toBeInTheDocument();
    expect(dialog.querySelector("[data-watch-status='appeared']")).toBeTruthy();
    expect(onPaymentAppeared).toHaveBeenCalledExactlyOnceWith(appeared);
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/dogecoin/mempool/watch?address=${ADDRESS}&minValueBase=1000000000`,
      expect.anything()
    );
  });

  it("shows timeout state and restarts the watch on retry", async () => {
    const user = userEvent.setup();
    const timeout = {
      address: ADDRESS,
      expiresAt: "2026-07-13T01:05:00.000Z",
    };
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        createStreamResponse([encodeSse("mempool.watch.timeout", timeout)])
      )
    );

    render(
      <DogecoinPaymentButton
        address={ADDRESS}
        mempoolWatch={{
          endpoint: "/api/dogecoin/mempool/watch",
          fetchImpl,
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    const dialog = await screen.findByRole("dialog");

    await expect(
      within(dialog).findByText(
        /No matching payment appeared within 5 minutes/u
      )
    ).resolves.toBeInTheDocument();
    expect(dialog.querySelector("[data-watch-status='timeout']")).toBeTruthy();

    const callsBeforeRetry = fetchImpl.mock.calls.length;

    await user.click(
      within(dialog).getByRole("button", { name: "Watch again" })
    );

    await waitFor(() => {
      expect(fetchImpl.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });

  it("shows a busy state when the watch endpoint returns 409", async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json(
          { error: "Another mempool watch session is already open." },
          { status: 409 }
        )
      )
    );

    render(
      <DogecoinPaymentButton
        address={ADDRESS}
        mempoolWatch={{
          endpoint: "/api/dogecoin/mempool/watch",
          fetchImpl,
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    const dialog = await screen.findByRole("dialog");

    await expect(
      within(dialog).findByText(
        /Another mempool watch session is already open/u
      )
    ).resolves.toBeInTheDocument();
    expect(dialog.querySelector("[data-watch-status='busy']")).toBeTruthy();
  });

  it("closes the watch when the dialog closes", async () => {
    const user = userEvent.setup();
    const abortFlags: boolean[] = [];
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
      const index = abortFlags.length;
      abortFlags.push(false);
      init?.signal?.addEventListener("abort", () => {
        abortFlags[index] = true;
      });
      return Promise.resolve(createStreamResponse([": keep-alive\n\n"]));
    });

    render(
      <DogecoinPaymentButton
        address={ADDRESS}
        mempoolWatch={{
          endpoint: "/api/dogecoin/mempool/watch",
          fetchImpl,
        }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    await screen.findByRole("dialog");
    await waitFor(() => {
      expect(fetchImpl.mock.calls.length).toBeGreaterThan(0);
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(abortFlags.some(Boolean)).toBeTruthy();
  });
});
