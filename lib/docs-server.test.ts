import { describe, expect, it } from "vitest";

import { readRegistryComponentSources } from "./docs-server";

describe("docs-server registry sources", () => {
  it("reads every dogecoin-payment-button registry file from disk", async () => {
    const sources = await readRegistryComponentSources();

    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0]).toMatchObject({
      language: "tsx",
      path: "registry/default/dogecoin-payment-button/dogecoin-payment-button.tsx",
      target: "components/dogecoin-payment-button/dogecoin-payment-button.tsx",
    });
    expect(sources[0]?.code).toContain("DogecoinPaymentButton");

    const index = sources.find((file) => file.path.endsWith("/index.ts"));
    expect(index).toMatchObject({
      language: "ts",
      target: "components/dogecoin-payment-button/index.ts",
    });
    expect(index?.code).toContain('from "./dogecoin-payment-button"');

    for (const source of sources) {
      expect(source.code.length).toBeGreaterThan(0);
      expect(
        source.target.startsWith("components/dogecoin-payment-button/")
      ).toBeTruthy();
    }
  });
});
