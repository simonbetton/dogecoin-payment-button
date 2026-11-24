import { DocsSectionHeading } from "@/components/docs/docs-section-heading";
import { PreviewPaymentButton } from "@/components/docs/preview-payment-button";
import { PrimitiveToggle } from "@/components/docs/primitive-toggle";
import type { PrimitiveBase } from "@/lib/docs";

export const PreviewSection = ({
  primitiveBase,
}: {
  primitiveBase: PrimitiveBase;
}) => (
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
      The block API and registry URL stay the same. Your project&apos;s shadcn
      base decides whether Base UI or Radix UI primitives are installed for{" "}
      <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
        button
      </code>{" "}
      and{" "}
      <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
        dialog
      </code>
      .
    </p>

    <div className="overflow-hidden rounded-xl border dark:inset-ring dark:inset-ring-white/5">
      <div className="bg-muted/30 flex items-center justify-between border-b px-4 py-2">
        <p className="text-sm font-medium">Preview</p>
        <p className="text-muted-foreground text-xs">
          {primitiveBase === "radix" ? "Radix UI" : "Base UI"} · mocked
        </p>
      </div>
      <div className="bg-card flex min-h-56 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-muted-foreground text-sm">
            Uses a fixed example address and a simulated mempool watch that
            detects a payment after three seconds. No environment variables
            required.
          </p>
          <PreviewPaymentButton />
        </div>
      </div>
    </div>
  </section>
);
