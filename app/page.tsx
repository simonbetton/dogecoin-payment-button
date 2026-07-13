import { CodeBlock } from "@/components/docs/code-block";
import { DocsHeader, DocsSidebar } from "@/components/docs/docs-header";
import { DocsSectionHeading } from "@/components/docs/docs-section-heading";
import { FileTabs } from "@/components/docs/file-tabs";
import { InstallationTabs } from "@/components/docs/installation-tabs";
import { LivePaymentButton } from "@/components/docs/live-payment-button";
import { PreviewPaymentButton } from "@/components/docs/preview-payment-button";
import { PrimitiveToggle } from "@/components/docs/primitive-toggle";
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
import {
  DogecoinKeyError,
  parseAccountXpub,
} from "@/registry/default/dogecoin-payment-button";

const MEMPOOL_WATCH_ENDPOINT = "/api/dogecoin/mempool/watch";

const getXpubSetupError = (xpub: string | undefined): string | null => {
  if (!xpub?.trim()) {
    return "DOGECOIN_XPUB is not set.";
  }

  try {
    parseAccountXpub(xpub);
    return null;
  } catch (error) {
    if (error instanceof DogecoinKeyError) {
      return error.message;
    }

    return "DOGECOIN_XPUB could not be validated.";
  }
};

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
  const xpub = process.env.DOGECOIN_XPUB;
  const setupError = getXpubSetupError(xpub);
  const hasMempoolToken = Boolean(process.env.ONLYDOGE_API_TOKEN?.trim());
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
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:font-medium focus:text-sm focus:shadow-lg focus:ring-3 focus:ring-ring/50"
        href="#main-content"
      >
        Skip to main content
      </a>
      <DocsHeader />
      <div className="grid flex-1 items-stretch xl:grid-cols-[minmax(0,1fr)_minmax(0,48rem)_minmax(0,1fr)]">
        <main
          className="mx-auto min-w-0 w-full max-w-3xl space-y-12 px-4 py-8 sm:px-6 lg:py-10 xl:col-start-2"
          id="main-content"
          tabIndex={-1}
        >
          <section aria-labelledby="overview" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="font-medium text-amber-700 text-sm dark:text-amber-400">
                  Registry block
                </p>
                <DocsSectionHeading as="h1" id="overview">
                  Dogecoin Payment Button
                </DocsSectionHeading>
                <p className="max-w-[56ch] text-pretty text-muted-foreground text-sm">
                  Installable shadcn registry block that derives BIP44 Dogecoin
                  payment addresses from an account-level public key, then shows
                  a QR code and copyable address in a dialog. Optionally watches
                  the mempool for an incoming payment.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="preview" className="space-y-4">
            <div className="space-y-2">
              <DocsSectionHeading id="preview">Preview</DocsSectionHeading>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PrimitiveToggle value={primitiveBase} />
                <p className="text-muted-foreground text-sm">
                  {primitiveBase === "radix"
                    ? "Install into a Radix UI project."
                    : "Install into a Base UI project (default)."}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              The block API and registry URL stay the same. Your project&apos;s
              shadcn base decides whether Base UI or Radix UI primitives are
              installed for{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                button
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                dialog
              </code>
              .
            </p>

            <div className="overflow-hidden rounded-xl border dark:inset-ring dark:inset-ring-white/5">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                <p className="font-medium text-sm">Preview</p>
                <p className="text-muted-foreground text-xs">
                  {primitiveBase === "radix" ? "Radix UI" : "Base UI"} · mocked
                </p>
              </div>
              <div className="flex min-h-56 items-center justify-center bg-card p-6 sm:p-10">
                <div className="w-full max-w-sm space-y-4 text-center">
                  <p className="text-muted-foreground text-sm">
                    Uses a fixed example address and a simulated mempool watch
                    that detects a payment after three seconds. No environment
                    variables required.
                  </p>
                  <PreviewPaymentButton />
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="live-demo" className="space-y-4">
            <div className="space-y-2">
              <DocsSectionHeading id="live-demo">Live demo</DocsSectionHeading>
              <p className="max-w-[56ch] text-pretty text-muted-foreground text-sm">
                Resolves a payment address from{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  DOGECOIN_XPUB
                </code>{" "}
                on the server
                {hasMempoolToken
                  ? " and watches the mempool through the same-origin SSE proxy."
                  : ". Set ONLYDOGE_API_TOKEN to enable live mempool watching."}
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border dark:inset-ring dark:inset-ring-white/5">
              <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
                <p className="font-medium text-sm">Live demo</p>
                <p className="text-muted-foreground text-xs">
                  {setupError ? "Setup required" : "API route"}
                </p>
              </div>
              <div className="flex min-h-56 items-center justify-center bg-card p-6 sm:p-10">
                {setupError ? (
                  <div className="w-full max-w-lg space-y-3 rounded-xl border border-dashed bg-muted/30 p-5">
                    <h3 className="font-medium">Setup required</h3>
                    <p className="text-destructive text-sm" role="alert">
                      {setupError}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Create a dedicated Dogecoin account at{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                        m/44&apos;/3&apos;/0&apos;
                      </code>{" "}
                      and set its public key in{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                        DOGECOIN_XPUB
                      </code>
                      . Accepts Dogecoin-native{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                        dgub
                      </code>{" "}
                      or Bitcoin-compatible{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                        xpub
                      </code>
                      .
                    </p>
                    <CodeBlock
                      code={`# .env.local
DOGECOIN_XPUB=dgub...
ONLYDOGE_API_TOKEN=sk_...`}
                      filename=".env.local"
                      language="bash"
                    />
                  </div>
                ) : (
                  <LivePaymentButton
                    amount="5"
                    mempoolWatch={
                      hasMempoolToken
                        ? { endpoint: MEMPOOL_WATCH_ENDPOINT }
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="installation" className="space-y-4">
            <div className="space-y-2">
              <DocsSectionHeading id="installation">
                Installation
              </DocsSectionHeading>
              <p className="max-w-[56ch] text-pretty text-muted-foreground text-sm">
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
              <p className="max-w-[56ch] text-pretty text-muted-foreground text-sm">
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
              <p className="max-w-[56ch] text-pretty text-muted-foreground text-sm">
                Copy these Next.js files to wire server-side address resolution
                and the optional OnlyDoge mempool SSE proxy.
              </p>
              <p className="max-w-[56ch] text-pretty text-muted-foreground text-sm">
                <span className="font-semibold text-amber-700 dark:text-amber-400 text-xs">
                  IMPORTANT:
                </span>{" "}
                Keep{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  DOGECOIN_XPUB
                </code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
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
              <p className="max-w-[56ch] text-pretty text-muted-foreground text-sm">
                Mempool watching is opt-in. Detection means the payment was seen
                in the mempool, not that it is confirmed. Use a dedicated
                account public key at{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  m/44&apos;/3&apos;/0&apos;
                </code>
                .
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4 dark:bg-transparent dark:inset-ring dark:inset-ring-white/5">
              <p className="text-sm">
                Registry URL used by this deployment:{" "}
                <code className="break-all font-mono text-xs" translate="no">
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
