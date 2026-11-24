import { CodeBlock } from "@/components/docs/code-block";
import { DocsSectionHeading } from "@/components/docs/docs-section-heading";
import { LivePaymentButton } from "@/components/docs/live-payment-button";
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

export const LiveDemoSection = () => {
  const setupError = getXpubSetupError(process.env.DOGECOIN_XPUB);
  const hasMempoolToken = Boolean(process.env.ONLYDOGE_API_TOKEN?.trim());

  return (
    <section aria-labelledby="live-demo" className="space-y-4">
      <div className="space-y-2">
        <DocsSectionHeading id="live-demo">Live demo</DocsSectionHeading>
        <p className="text-muted-foreground max-w-[56ch] text-sm text-pretty">
          Resolves a payment address from{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
            DOGECOIN_XPUB
          </code>{" "}
          on the server
          {hasMempoolToken
            ? " and watches the mempool through the same-origin SSE proxy."
            : ". Set ONLYDOGE_API_TOKEN to enable live mempool watching."}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border dark:inset-ring dark:inset-ring-white/5">
        <div className="bg-muted/30 flex items-center justify-between border-b px-4 py-2">
          <p className="text-sm font-medium">Live demo</p>
          <p className="text-muted-foreground text-xs">
            {setupError ? "Setup required" : "API route"}
          </p>
        </div>
        <div className="bg-card flex min-h-56 items-center justify-center p-6 sm:p-10">
          {setupError ? (
            <div className="bg-muted/30 w-full max-w-lg space-y-3 rounded-xl border border-dashed p-5">
              <h3 className="font-medium">Setup required</h3>
              <p className="text-destructive text-sm" role="alert">
                {setupError}
              </p>
              <p className="text-muted-foreground text-sm">
                Create a dedicated Dogecoin account at{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                  m/44&apos;/3&apos;/0&apos;
                </code>{" "}
                and set its public key in{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                  DOGECOIN_XPUB
                </code>
                . Accepts Dogecoin-native{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                  dgub
                </code>{" "}
                or Bitcoin-compatible{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
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
  );
};
