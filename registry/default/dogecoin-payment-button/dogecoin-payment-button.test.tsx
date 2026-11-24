import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AddressSelectionResult } from "./address-selection";
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

  it("retries a failed resolution inside the same open dialog", async () => {
    const resolveAddress = vi
      .fn<DogecoinPaymentResolveFn>()
      .mockRejectedValueOnce(new Error("Backend unavailable"))
      .mockResolvedValueOnce({
        address: ADDRESS,
        index: 0,
        mode: "verified",
        nextStartIndex: 0,
        uncheckedMode: false,
      });

    render(<DogecoinPaymentButton resolveAddress={resolveAddress} />);
    fireEvent.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Try again" })
    );

    await expect(
      within(dialog).findByText(ADDRESS)
    ).resolves.toBeInTheDocument();
    expect(resolveAddress).toHaveBeenCalledTimes(2);
  });

  it("never restarts a watch for the previously displayed address on reopening", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
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
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(new ReadableStream()))
    );

    render(
      <DogecoinPaymentButton
        mempoolWatch={{ endpoint: "/watch", fetchImpl }}
        resolveAddress={resolveAddress}
      />
    );
    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    await expect(screen.findByText(ADDRESS)).resolves.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    await expect(screen.findByText(ADDRESS_19)).resolves.toBeInTheDocument();

    expect(fetchImpl.mock.calls.map(([url]) => url)).toStrictEqual([
      `/watch?address=${ADDRESS}`,
      `/watch?address=${ADDRESS_19}`,
    ]);
  });

  it("ignores a late resolver success after close and reopen", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const previous = Promise.withResolvers<AddressSelectionResult>();
    const current = Promise.withResolvers<AddressSelectionResult>();
    const resolveAddress = vi
      .fn<DogecoinPaymentResolveFn>()
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise);
    const result: AddressSelectionResult = {
      address: ADDRESS_19,
      index: 19,
      mode: "verified",
      nextStartIndex: 19,
      uncheckedMode: false,
    };
    render(<DogecoinPaymentButton resolveAddress={resolveAddress} />);
    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));

    await act(async () => {
      current.resolve(result);
      await current.promise;
    });
    await act(async () => {
      previous.resolve({
        ...result,
        address: ADDRESS,
        mode: "unchecked",
        uncheckedMode: true,
      });
      await previous.promise;
    });

    expect(screen.getByText(ADDRESS_19)).toBeInTheDocument();
    expect(screen.queryByText(ADDRESS)).not.toBeInTheDocument();
    resolveAddress.mockResolvedValueOnce(result);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    expect(resolveAddress).toHaveBeenLastCalledWith({
      startIndex: 19,
      uncheckedMode: false,
    });
  });

  it("shows an independent resolver abort as a retryable error", async () => {
    const resolveAddress = vi
      .fn<DogecoinPaymentResolveFn>()
      .mockRejectedValue(new DOMException("Upstream timed out", "AbortError"));
    render(<DogecoinPaymentButton resolveAddress={resolveAddress} />);
    fireEvent.click(screen.getByRole("button", { name: "Send me Dogecoin" }));

    await expect(
      screen.findByText("Upstream timed out")
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  it("preserves the unchecked cursor without watching known-used or unchecked addresses", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const resolveAddress = vi
      .fn<DogecoinPaymentResolveFn>()
      .mockResolvedValueOnce({
        address: ADDRESS,
        index: 0,
        mode: "exhausted",
        nextStartIndex: 19,
        uncheckedMode: true,
      })
      .mockResolvedValueOnce({
        address: ADDRESS_19,
        index: 19,
        mode: "unchecked",
        nextStartIndex: 38,
        uncheckedMode: true,
      });
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(""))
    );
    render(
      <DogecoinPaymentButton
        mempoolWatch={{ endpoint: "/watch", fetchImpl }}
        resolveAddress={resolveAddress}
      />
    );
    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    await expect(screen.findByText(ADDRESS)).resolves.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    await expect(screen.findByText(ADDRESS_19)).resolves.toBeInTheDocument();

    expect(resolveAddress).toHaveBeenLastCalledWith({
      startIndex: 19,
      uncheckedMode: true,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shows a payment details error for an invalid static amount", async () => {
    render(<DogecoinPaymentButton address={ADDRESS} amount="0" />);
    fireEvent.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    await expect(
      screen.findByText("Amount must be greater than zero.")
    ).resolves.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy address" })
    ).not.toBeInTheDocument();
  });

  it("keeps payment details available when watch setup fails", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <DogecoinPaymentButton
        address={ADDRESS}
        mempoolWatch={{ endpoint: "https://[" }}
      />
    );

    await user.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    await expect(screen.findByText(ADDRESS)).resolves.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Watch again" })
    ).toBeInTheDocument();
  });

  it("does not report an address as copied when the clipboard rejects", async () => {
    writeText.mockRejectedValueOnce(new Error("Clipboard permission denied"));
    render(<DogecoinPaymentButton address={ADDRESS} />);
    fireEvent.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
    await expect(
      screen.findByRole("button", { name: "Copy failed" })
    ).resolves.toBeInTheDocument();
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

  it("retries a busy watch on the same payment and publishes one terminal result", async () => {
    const onPaymentAppeared =
      vi.fn<(payload: MempoolWatchAppearedPayload) => void>();
    const appeared: MempoolWatchAppearedPayload = {
      address: ADDRESS,
      detectedAt: "2026-07-13T01:00:00.000Z",
      outputs: [{ valueBase: "100000000", vout: 0 }],
      source: "catchup",
      txid: "catchup-payment",
    };
    const event = encodeSse("mempool.watch.appeared", appeared);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(createStreamResponse([event + event]));

    render(
      <DogecoinPaymentButton
        address={ADDRESS}
        amount="1"
        mempoolWatch={{ endpoint: "/watch", fetchImpl }}
        onPaymentAppeared={onPaymentAppeared}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Send me Dogecoin" }));
    fireEvent.click(await screen.findByRole("button", { name: "Watch again" }));

    await expect(
      screen.findByText(/Payment detected in the mempool/u)
    ).resolves.toBeInTheDocument();
    expect(fetchImpl.mock.calls.map(([url]) => url)).toStrictEqual([
      `/watch?address=${ADDRESS}&minValueBase=100000000`,
      `/watch?address=${ADDRESS}&minValueBase=100000000`,
    ]);
    expect(onPaymentAppeared).toHaveBeenCalledExactlyOnceWith(appeared);
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
