import Link from "next/link";

import type { PrimitiveBase } from "@/lib/docs";
import { cn } from "@/lib/utils";

interface PrimitiveToggleProps {
  className?: string;
  value: PrimitiveBase;
}

export const PrimitiveToggle = ({ className, value }: PrimitiveToggleProps) => (
  <nav
    aria-label="Primitive library"
    className={cn(
      "inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1",
      className
    )}
  >
    <Link
      aria-current={value === "base-ui" ? "page" : undefined}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        value === "base-ui"
          ? "bg-background text-foreground shadow-sm dark:shadow-none"
          : "text-muted-foreground hover:text-foreground"
      )}
      href="/?base=base-ui"
      prefetch={false}
      replace
      scroll={false}
    >
      Base UI
    </Link>
    <Link
      aria-current={value === "radix" ? "page" : undefined}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        value === "radix"
          ? "bg-background text-foreground shadow-sm dark:shadow-none"
          : "text-muted-foreground hover:text-foreground"
      )}
      href="/?base=radix"
      prefetch={false}
      replace
      scroll={false}
    >
      Radix UI
    </Link>
  </nav>
);
