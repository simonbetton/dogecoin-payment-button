import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const ADDRESS = "DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B";

const createRequest = (query: string, signal?: AbortSignal): Request =>
  new Request(`http://localhost/api/dogecoin/mempool/watch?${query}`, {
    method: "GET",
    signal,
  });

describe("GET /api/dogecoin/mempool/watch", () => {
  beforeEach(() => {
    vi.stubEnv("ONLYDOGE_API_TOKEN", "sk_test_token");
    vi.stubEnv("ONLYDOGE_API_BASE_URL", "https://platform.onlydoge.io");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 503 when the API token is missing", async () => {
    vi.stubEnv("ONLYDOGE_API_TOKEN", "");

    const response = await GET(createRequest(`address=${ADDRESS}`));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      error: "ONLYDOGE_API_TOKEN is not configured.",
    });
  });

  it("returns 400 for an invalid address", async () => {
    const response = await GET(createRequest("address=not-valid"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({
      error: "A valid Dogecoin P2PKH address is required.",
    });
  });

  it("returns 400 for an invalid minValueBase", async () => {
    const response = await GET(
      createRequest(`address=${ADDRESS}&minValueBase=1.5`)
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/minValueBase/u),
    });
  });

  it("forwards the stream with the API token and no-store headers", async () => {
    const encoder = new TextEncoder();
    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: mempool.watch.appeared\ndata: {"ok":true}\n\n`)
        );
        controller.close();
      },
    });

    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(upstreamBody, {
          headers: { "Content-Type": "text/event-stream" },
          status: 200,
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      createRequest(`address=${ADDRESS}&minValueBase=1000000000`)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-store");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://platform.onlydoge.io/v1/explorer/mempool/watch?address=DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B&minValueBase=1000000000",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "text/event-stream",
          "x-api-token": "sk_test_token",
        }),
        method: "GET",
      })
    );

    await expect(response.text()).resolves.toContain("mempool.watch.appeared");
  });

  it("emits a timeout event before the Vercel function deadline", async () => {
    vi.useFakeTimers();
    let upstreamAborted = false;
    const upstreamBody = new ReadableStream<Uint8Array>();
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      init?.signal?.addEventListener("abort", () => {
        upstreamAborted = true;
      });

      return Promise.resolve(
        new Response(upstreamBody, {
          headers: { "Content-Type": "text/event-stream" },
          status: 200,
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(createRequest(`address=${ADDRESS}`));
    const responseBody = response.text();

    await vi.advanceTimersByTimeAsync(299_000);

    await expect(responseBody).resolves.toContain(
      "event: mempool.watch.timeout"
    );
    await expect(responseBody).resolves.toContain(`"address":"${ADDRESS}"`);
    expect(upstreamAborted).toBeTruthy();
  });

  it("propagates upstream 409 as a busy response", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ error: "session open" }, { status: 409 }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(createRequest(`address=${ADDRESS}`));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toStrictEqual({
      error: "Another mempool watch session is already open for this API key.",
      status: "409",
      upstreamUrl: `https://platform.onlydoge.io/v1/explorer/mempool/watch?address=${ADDRESS}`,
    });
  });

  it("returns a detailed cause when the upstream fetch throws", async () => {
    const nested = Object.assign(
      new Error("connect ECONNREFUSED 1.2.3.4:443"),
      {
        address: "1.2.3.4",
        code: "ECONNREFUSED",
        errno: -61,
        port: 443,
        syscall: "connect",
      }
    );
    const failure = new TypeError("fetch failed", { cause: nested });

    const fetchMock = vi.fn<typeof fetch>(() => Promise.reject(failure));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(createRequest(`address=${ADDRESS}`));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toStrictEqual({
      cause:
        "TypeError: fetch failed | connect ECONNREFUSED 1.2.3.4:443 | code=ECONNREFUSED errno=-61 syscall=connect address=1.2.3.4 port=443",
      error: "Unable to reach OnlyDoge mempool watch.",
      upstreamUrl: `https://platform.onlydoge.io/v1/explorer/mempool/watch?address=${ADDRESS}`,
    });
  });

  it("aborts the upstream request when the client disconnects", async () => {
    const clientController = new AbortController();
    let upstreamAborted = false;

    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      init?.signal?.addEventListener("abort", () => {
        upstreamAborted = true;
      });

      // oxlint-disable-next-line promise/avoid-new -- Abortable upstream mock must reject when the client signal aborts.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true }
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pending = GET(
      createRequest(`address=${ADDRESS}`, clientController.signal)
    );

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    clientController.abort();

    await vi.waitFor(() => {
      expect(upstreamAborted).toBeTruthy();
    });

    const response = await pending;
    expect(response.status).toBe(499);
  });
});
