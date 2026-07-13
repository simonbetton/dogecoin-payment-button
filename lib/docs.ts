export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export type PrimitiveBase = "base-ui" | "radix";

export const PACKAGE_MANAGERS = [
  "pnpm",
  "npm",
  "yarn",
  "bun",
] as const satisfies readonly PackageManager[];

export const DEFAULT_PACKAGE_MANAGER: PackageManager = "pnpm";

export const DEFAULT_PRIMITIVE_BASE: PrimitiveBase = "base-ui";

export const DOC_SECTIONS = [
  { href: "#overview", id: "overview", label: "Overview" },
  { href: "#preview", id: "preview", label: "Preview" },
  { href: "#live-demo", id: "live-demo", label: "Live demo" },
  { href: "#installation", id: "installation", label: "Installation" },
  { href: "#usage", id: "usage", label: "Usage" },
  { href: "#integration", id: "integration", label: "Next.js integration" },
  { href: "#notes", id: "notes", label: "Notes" },
] as const;

export const REGISTRY_ITEM_PATH = "/r/dogecoin-payment-button.json";

export const parsePrimitiveBase = (
  value?: string | string[]
): PrimitiveBase => {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "radix" ? "radix" : DEFAULT_PRIMITIVE_BASE;
};

const withHttps = (hostOrUrl: string): string => {
  const trimmed = hostOrUrl.replace(/\/$/u, "");
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

export const getRegistryOrigin = (): string => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/u, "");
  }

  // Stable production domain (custom domain or project.vercel.app).
  if (process.env.VERCEL_ENV === "production") {
    const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (productionHost) {
      return withHttps(productionHost);
    }
  }

  // Preview deployments (and production fallback).
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return withHttps(vercelUrl);
  }

  return "http://localhost:3000";
};

export const getRegistryItemUrl = (origin = getRegistryOrigin()): string =>
  `${origin}${REGISTRY_ITEM_PATH}`;

const SHADCN_RUNNERS: Record<PackageManager, string> = {
  bun: "bunx",
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "yarn dlx",
};

export const getInstallCommand = (
  packageManager: PackageManager,
  registryUrl = getRegistryItemUrl()
): string =>
  `${SHADCN_RUNNERS[packageManager]} shadcn@latest add ${registryUrl}`;

export const getInstallCommands = (
  registryUrl = getRegistryItemUrl()
): Record<PackageManager, string> => ({
  bun: getInstallCommand("bun", registryUrl),
  npm: getInstallCommand("npm", registryUrl),
  pnpm: getInstallCommand("pnpm", registryUrl),
  yarn: getInstallCommand("yarn", registryUrl),
});

export const MANUAL_NPM_DEPENDENCIES = [
  "@scure/bip32",
  "@noble/hashes",
  "@scure/base",
  "uqr",
  "lucide-react",
] as const;

export const MANUAL_REGISTRY_DEPENDENCIES = ["button", "dialog"] as const;

const PACKAGE_INSTALL_RUNNERS: Record<PackageManager, string> = {
  bun: "bun add",
  npm: "npm install",
  pnpm: "pnpm add",
  yarn: "yarn add",
};

export const getManualDependencyCommand = (
  packageManager: PackageManager
): string =>
  `${PACKAGE_INSTALL_RUNNERS[packageManager]} ${MANUAL_NPM_DEPENDENCIES.join(" ")}`;

export const getManualRegistryDependencyCommand = (
  packageManager: PackageManager
): string =>
  `${SHADCN_RUNNERS[packageManager]} shadcn@latest add ${MANUAL_REGISTRY_DEPENDENCIES.join(" ")}`;

export const getManualDependencyCommands = (): Record<
  PackageManager,
  string
> => ({
  bun: getManualDependencyCommand("bun"),
  npm: getManualDependencyCommand("npm"),
  pnpm: getManualDependencyCommand("pnpm"),
  yarn: getManualDependencyCommand("yarn"),
});

export const getManualRegistryDependencyCommands = (): Record<
  PackageManager,
  string
> => ({
  bun: getManualRegistryDependencyCommand("bun"),
  npm: getManualRegistryDependencyCommand("npm"),
  pnpm: getManualRegistryDependencyCommand("pnpm"),
  yarn: getManualRegistryDependencyCommand("yarn"),
});

const CONSUMER_IMPORT_REWRITE =
  /@\/registry\/default\/dogecoin-payment-button/gu;

export const toConsumerImportPath = (source: string): string =>
  source.replace(
    CONSUMER_IMPORT_REWRITE,
    "@/components/dogecoin-payment-button"
  );

export const USAGE_EXAMPLE = `"use client";

import { DogecoinPaymentButton } from "@/components/dogecoin-payment-button";
import type {
  AddressSelectionResult,
  DogecoinPaymentResolveFn,
  SelectionState,
} from "@/components/dogecoin-payment-button";

const resolvePaymentAddress: DogecoinPaymentResolveFn = async (
  state: SelectionState
): Promise<AddressSelectionResult> => {
  const response = await fetch("/api/dogecoin/resolve-address", {
    body: JSON.stringify(state),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to resolve a Dogecoin payment address.");
  }

  return (await response.json()) as AddressSelectionResult;
};

export function DonateButton() {
  return (
    <DogecoinPaymentButton
      amount="5"
      mempoolWatch={{ endpoint: "/api/dogecoin/mempool/watch" }}
      resolveAddress={resolvePaymentAddress}
    />
  );
}
`;
