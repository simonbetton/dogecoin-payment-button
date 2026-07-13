import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_PACKAGE_MANAGER,
  DEFAULT_PRIMITIVE_BASE,
  getInstallCommand,
  getInstallCommands,
  getManualDependencyCommand,
  getManualDependencyCommands,
  getManualRegistryDependencyCommand,
  getManualRegistryDependencyCommands,
  getRegistryItemUrl,
  getRegistryOrigin,
  parsePrimitiveBase,
  toConsumerImportPath,
} from "./docs";

describe("docs helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults the primitive base to Base UI", () => {
    expect(parsePrimitiveBase()).toBe(DEFAULT_PRIMITIVE_BASE);
    expect(parsePrimitiveBase("base-ui")).toBe("base-ui");
    expect(parsePrimitiveBase("radix")).toBe("radix");
    expect(parsePrimitiveBase(["radix", "base-ui"])).toBe("radix");
  });

  it("builds package-manager install commands", () => {
    const url = "http://localhost:3000/r/dogecoin-payment-button.json";
    expect(getInstallCommand("pnpm", url)).toBe(
      `pnpm dlx shadcn@latest add ${url}`
    );
    expect(getInstallCommand("npm", url)).toBe(`npx shadcn@latest add ${url}`);
    expect(getInstallCommand("yarn", url)).toBe(
      `yarn dlx shadcn@latest add ${url}`
    );
    expect(getInstallCommand("bun", url)).toBe(`bunx shadcn@latest add ${url}`);
    expect(DEFAULT_PACKAGE_MANAGER).toBe("pnpm");
  });

  it("returns all install commands together", () => {
    const url = getRegistryItemUrl("https://example.com");
    expect(url).toBe("https://example.com/r/dogecoin-payment-button.json");
    expect(getInstallCommands(url)).toStrictEqual({
      bun: `bunx shadcn@latest add ${url}`,
      npm: `npx shadcn@latest add ${url}`,
      pnpm: `pnpm dlx shadcn@latest add ${url}`,
      yarn: `yarn dlx shadcn@latest add ${url}`,
    });
  });

  it("resolves registry origin for local, preview, and production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(getRegistryOrigin()).toBe("http://localhost:3000");

    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "dogecoin-send-web-git-main-acme.vercel.app");
    expect(getRegistryOrigin()).toBe(
      "https://dogecoin-send-web-git-main-acme.vercel.app"
    );

    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "dogecoin-send.example.com");
    vi.stubEnv("VERCEL_URL", "dogecoin-send-web-abc123.vercel.app");
    expect(getRegistryOrigin()).toBe("https://dogecoin-send.example.com");

    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://custom.example.com/");
    expect(getRegistryOrigin()).toBe("https://custom.example.com");
  });

  it("rewrites registry imports to consumer paths", () => {
    const source = `import { resolveDogecoinPaymentAddress } from "@/registry/default/dogecoin-payment-button";
import { isDogecoinP2pkhAddress } from "@/registry/default/dogecoin-payment-button/dogecoin";`;
    expect(toConsumerImportPath(source)).toBe(
      `import { resolveDogecoinPaymentAddress } from "@/components/dogecoin-payment-button";
import { isDogecoinP2pkhAddress } from "@/components/dogecoin-payment-button/dogecoin";`
    );
  });

  it("builds package-manager manual dependency commands", () => {
    expect(getManualDependencyCommand("pnpm")).toBe(
      "pnpm add @scure/bip32 @noble/hashes @scure/base uqr lucide-react"
    );
    expect(getManualDependencyCommand("npm")).toBe(
      "npm install @scure/bip32 @noble/hashes @scure/base uqr lucide-react"
    );
    expect(getManualDependencyCommands().yarn).toBe(
      "yarn add @scure/bip32 @noble/hashes @scure/base uqr lucide-react"
    );
  });

  it("builds package-manager manual registry dependency commands", () => {
    expect(getManualRegistryDependencyCommand("pnpm")).toBe(
      "pnpm dlx shadcn@latest add button dialog"
    );
    expect(getManualRegistryDependencyCommand("bun")).toBe(
      "bunx shadcn@latest add button dialog"
    );
    expect(getManualRegistryDependencyCommands().npm).toBe(
      "npx shadcn@latest add button dialog"
    );
  });
});
