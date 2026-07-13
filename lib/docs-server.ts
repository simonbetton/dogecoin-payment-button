import { readFile } from "node:fs/promises";
import path from "node:path";

import { headers } from "next/headers";

import { getRegistryOrigin, toConsumerImportPath } from "@/lib/docs";
import registryManifest from "@/registry.json";

const PROJECT_SOURCES = {
  "app/api/dogecoin/mempool/watch/route.ts": [
    "app",
    "api",
    "dogecoin",
    "mempool",
    "watch",
    "route.ts",
  ],
  "app/api/dogecoin/resolve-address/route.ts": [
    "app",
    "api",
    "dogecoin",
    "resolve-address",
    "route.ts",
  ],
  "lib/onlydoge.ts": ["lib", "onlydoge.ts"],
} as const;

export type ProjectSourcePath = keyof typeof PROJECT_SOURCES;

export interface RegistryComponentSource {
  code: string;
  language: "ts" | "tsx";
  path: string;
  target: string;
}

interface RegistryFileEntry {
  path: string;
  target?: string;
  type: string;
}

interface RegistryItemEntry {
  files?: RegistryFileEntry[];
  name: string;
}

const REGISTRY_ITEM_PREFIX = "registry/default/dogecoin-payment-button/";

const languageFromPath = (filePath: string): "ts" | "tsx" =>
  filePath.endsWith(".tsx") ? "tsx" : "ts";

const readProjectPath = (relativePath: ProjectSourcePath): Promise<string> => {
  const segments = PROJECT_SOURCES[relativePath];
  return readFile(
    path.join(
      // Keep NFT scoped. Matching files are listed in next.config.ts.
      // oxlint-disable-next-line no-inline-comments -- Required by Turbopack NFT scoping.
      /* turbopackIgnore: true */ process.cwd(),
      ...segments
    ),
    "utf-8"
  );
};

const toRegistryFileName = (filePath: string): string => {
  if (!filePath.startsWith(REGISTRY_ITEM_PREFIX)) {
    throw new Error(`Unexpected registry file path: ${filePath}`);
  }

  const fileName = filePath.slice(REGISTRY_ITEM_PREFIX.length);
  if (
    !fileName ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("..")
  ) {
    throw new Error(`Unexpected registry file name: ${filePath}`);
  }

  return fileName;
};

const readRegistryPath = (fileName: string): Promise<string> =>
  readFile(
    path.join(
      // Keep NFT scoped to the registry component directory.
      // oxlint-disable-next-line no-inline-comments -- Required by Turbopack NFT scoping.
      /* turbopackIgnore: true */ process.cwd(),
      "registry",
      "default",
      "dogecoin-payment-button",
      fileName
    ),
    "utf-8"
  );

export const readProjectSource = async (
  relativePath: ProjectSourcePath,
  options: { rewriteImports?: boolean } = {}
): Promise<string> => {
  const source = await readProjectPath(relativePath);
  return options.rewriteImports ? toConsumerImportPath(source) : source;
};

export const readRegistryComponentSources = async (
  itemName = "dogecoin-payment-button"
): Promise<RegistryComponentSource[]> => {
  const item = (registryManifest.items as RegistryItemEntry[]).find(
    (entry) => entry.name === itemName
  );

  if (!item?.files?.length) {
    throw new Error(`Registry item "${itemName}" has no files.`);
  }

  return await Promise.all(
    item.files.map(async (file) => {
      const code = await readRegistryPath(toRegistryFileName(file.path));
      const target =
        file.target ??
        file.path.replace(/^registry\/default\//u, "components/");

      return {
        code,
        language: languageFromPath(file.path),
        path: file.path,
        target,
      };
    })
  );
};

/**
 * Prefer the request host so install commands match the domain the visitor is
 * on (local, Vercel preview, or production). Falls back to env-based origin.
 */
export const resolveRegistryOrigin = async (): Promise<string> => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/u, "");
  }

  try {
    const headerStore = await headers();
    const host =
      headerStore.get("x-forwarded-host")?.split(",")[0]?.trim() ??
      headerStore.get("host")?.trim();

    if (host) {
      const isLocal =
        host.startsWith("localhost") || host.startsWith("127.0.0.1");
      const proto =
        headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
        (isLocal ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() is unavailable outside a request context.
  }

  return getRegistryOrigin();
};
