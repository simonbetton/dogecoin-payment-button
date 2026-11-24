import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const ACCOUNT_XPUB =
  "xpub6Bwh5PFUDzJdTk9os6xLrCnMLtX9NX8buQC51ttDZSGzBrsu8q8e3YXpG7zeGsKYNqiMM1jy4mT6v1mriqKoWcvA8R27m3oKPS9M7wAwugq";
const EXHAUSTED_INDEX = 2 ** 31;

const resolve = (body: unknown, signal?: AbortSignal): Promise<Response> =>
  POST(
    new Request("http://localhost/api/dogecoin/resolve-address", {
      body: JSON.stringify(body),
      method: "POST",
      signal,
    })
  );

describe("POST /api/dogecoin/resolve-address", () => {
  beforeEach(() => {
    vi.stubEnv("DOGECOIN_XPUB", ACCOUNT_XPUB);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a hardened request cursor before deriving", async () => {
    const response = await resolve({
      startIndex: EXHAUSTED_INDEX,
      uncheckedMode: false,
    });
    expect(response.status).toBe(400);
  });

  it("returns a terminal cursor after the last unchecked address and rejects its reuse", async () => {
    const response = await resolve({
      startIndex: EXHAUSTED_INDEX - 1,
      uncheckedMode: true,
    });
    expect(response.status).toBe(200);
    const selection: unknown = await response.json();
    expect(selection).toMatchObject({
      index: EXHAUSTED_INDEX - 1,
      mode: "unchecked",
      nextStartIndex: EXHAUSTED_INDEX,
    });

    const exhausted = await resolve({
      startIndex: EXHAUSTED_INDEX,
      uncheckedMode: true,
    });
    expect(exhausted.status).toBe(422);
  });

  it("stops before resolving for a disconnected client", async () => {
    const response = await resolve(null, AbortSignal.abort());
    expect(response.status).toBe(499);
  });
});
