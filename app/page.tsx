import { CodeBlock } from "@/components/docs/code-block";
import { DocsHeader, DocsSidebar } from "@/components/docs/docs-header";
import { DocsSectionHeading } from "@/components/docs/docs-section-heading";
import { FileTabs } from "@/components/docs/file-tabs";
import { InstallationTabs } from "@/components/docs/installation-tabs";
import { LiveDemoSection } from "@/components/docs/live-demo-section";
import { PreviewSection } from "@/components/docs/preview-section";
import type { PackageManager } from "@/lib/docs";
import {
  getInstallCommands,
  getManualDependencyCommands,
  getManualRegistryDependencyCommands,
  getRegistryItemUrl,
  PACKAGE_MANAGERS,
  parsePrimitiveBase,
  USAGE_EXAMPLE,
} from "@/lib/docs";
import {
  readProjectSource,
  readRegistryComponentSources,
  resolveRegistryOrigin,
} from "@/lib/docs-server";
import { highlightCode } from "@/lib/highlight-code";

const highlightPackageManagerCommands = async (
  commands: Record<PackageManager, string>
): Promise<Record<PackageManager, string>> => {
  const entries = await Promise.all(
    PACKAGE_MANAGERS.map(
      async (manager) =>
        [manager, await highlightCode(commands[manager], "bash")] as const
    )
  );
  return Object.fromEntries(entries) as Record<PackageManager, string>;
};

interface HomePageProps {
  searchParams: Promise<{
    base?: string | string[];
  }>;
}

const HomePage = async ({ searchParams }: HomePageProps) => {
  const params = await searchParams;
  const primitiveBase = parsePrimitiveBase(params.base);
  const registryUrl = getRegistryItemUrl(await resolveRegistryOrigin());
  const installCommands = getInstallCommands(registryUrl);
  const manualDependencyCommands = getManualDependencyCommands();
  const manualRegistryCommands = getManualRegistryDependencyCommands();

  const [resolveAddressSource, routeSource, onlydogeSource, registrySources] =
    await Promise.all([
      readProjectSource("app/api/dogecoin/resolve-address/route.ts", {
        rewriteImports: true,
      }),
      readProjectSource("app/api/dogecoin/mempool/watch/route.ts", {
        rewriteImports: true,
      }),
      readProjectSource("lib/onlydoge.ts"),
      readRegistryComponentSources(),
    ]);

  const integrationFiles = [
    {
      code: resolveAddressSource,
      filename: "app/api/dogecoin/resolve-address/route.ts",
      language: "tsx" as const,
    },
    {
      code: routeSource,
      filename: "app/api/dogecoin/mempool/watch/route.ts",
      language: "tsx" as const,
    },
    {
      code: onlydogeSource,
      filename: "lib/onlydoge.ts",
      language: "ts" as const,
    },
  ];

  const [
    highlightedInstallCommands,
    highlightedManualDependencyCommands,
    highlightedManualRegistryCommands,
    highlightedIntegrationFiles,
    highlightedRegistrySources,
  ] = await Promise.all([
    highlightPackageManagerCommands(installCommands),
    highlightPackageManagerCommands(manualDependencyCommands),
    highlightPackageManagerCommands(manualRegistryCommands),
    Promise.all(
      integrationFiles.map(async (file) => ({
        ...file,
        highlightedCode: await highlightCode(file.code, file.language),
      }))
    ),
    Promise.all(
      registrySources.map(async (file) => ({
        code: file.code,
        filename: file.target,
        highlightedCode: await highlightCode(file.code, file.language),
        language: file.language,
      }))
    ),
  ]);

  return (
    <div className="isolate flex min-h-dvh flex-col">
      <a
        className="focus:bg-background focus:ring-ring/50 sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-3"
        href="#main-content"
      >
        Skip to main content
      </a>
      <DocsHeader />
      <div className="grid flex-1 items-stretch xl:grid-cols-[minmax(0,1fr)_minmax(0,48rem)_minmax(0,1fr)]">
        <main
          className="mx-auto w-full max-w-3xl min-w-0 space-y-12 px-4 py-8 sm:px-6 lg:py-10 xl:col-start-2"
          id="main-content"
          tabIndex={-1}
        >
          <section aria-labelledby="overview" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Registry block
                </p>
                <DocsSectionHeading as="h1" id="overview">
                  Dogecoin Payment Button
                </DocsSectionHeading>
                <p className="text-muted-foreground max-w-[56ch] text-sm text-pretty">
                  Installable shadcn registry block that derives BIP44 Dogecoin
                  payment addresses from an account-level public key, then shows
                  a QR code and copyable address in a dialog. Optionally watches
                  the mempool for an incoming payment.
                </p>
              </div>
            </div>
          </section>

          <PreviewSection primitiveBase={primitiveBase} />
          <LiveDemoSection />

          <section aria-labelledby="installation" className="space-y-4">
            <div className="space-y-2">
              <DocsSectionHeading id="installation">
                Installation
              </DocsSectionHeading>
              <p className="text-muted-foreground max-w-[56ch] text-sm text-pretty">
                Add the registry block with the shadcn CLI, or copy the
                component files manually.
              </p>
            </div>
            <InstallationTabs
              highlightedInstallCommands={highlightedInstallCommands}
              highlightedManualDependencyCommands={
                highlightedManualDependencyCommands
              }
              highlightedManualRegistryCommands={
                highlightedManualRegistryCommands
              }
              installCommands={installCommands}
              manualDependencyCommands={manualDependencyCommands}
              manualRegistryCommands={manualRegistryCommands}
              sourceFiles={highlightedRegistrySources}
            />
          </section>

          <section aria-labelledby="usage" className="space-y-4">
            <div className="space-y-2">
              <DocsSectionHeading id="usage">Usage</DocsSectionHeading>
              <p className="text-muted-foreground max-w-[56ch] text-sm text-pretty">
                Prefer resolving the account public key on the server and
                passing a resolver into the button.
              </p>
            </div>
            <CodeBlock
              code={USAGE_EXAMPLE}
              filename="components/donate-button.tsx"
              language="tsx"
            />
          </section>

          <section aria-labelledby="integration" className="space-y-4">
            <div className="space-y-2">
              <DocsSectionHeading id="integration">
                Next.js integration
              </DocsSectionHeading>
              <p className="text-muted-foreground max-w-[56ch] text-sm text-pretty">
                Copy these Next.js files to wire server-side address resolution
                and the optional OnlyDoge mempool SSE proxy.
              </p>
              <p className="text-muted-foreground max-w-[56ch] text-sm text-pretty">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  IMPORTANT:
                </span>{" "}
                Keep{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                  DOGECOIN_XPUB
                </code>{" "}
                and{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                  ONLYDOGE_API_TOKEN
                </code>{" "}
                on the server.
              </p>
            </div>
            <FileTabs files={highlightedIntegrationFiles} collapsible={true} />
          </section>

          <section aria-labelledby="notes" className="space-y-4">
            <div className="space-y-2">
              <DocsSectionHeading id="notes">Notes</DocsSectionHeading>
              <p className="text-muted-foreground max-w-[56ch] text-sm text-pretty">
                Mempool watching is opt-in. Detection means the payment was seen
                in the mempool, not that it is confirmed. Use a dedicated
                account public key at{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                  m/44&apos;/3&apos;/0&apos;
                </code>
                .
              </p>
            </div>
            <div className="bg-muted/20 rounded-xl border p-4 dark:bg-transparent dark:inset-ring dark:inset-ring-white/5">
              <p className="text-sm">
                Registry URL used by this deployment:{" "}
                <code className="font-mono text-xs break-all" translate="no">
                  {registryUrl}
                </code>
              </p>
            </div>
          </section>
        </main>
        <DocsSidebar />
      </div>
    </div>
  );
};

export default HomePage;
