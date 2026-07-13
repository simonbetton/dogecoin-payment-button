import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DocsHeadingLevel = "h1" | "h2";

interface DocsSectionHeadingProps {
  as?: DocsHeadingLevel;
  children: ReactNode;
  className?: string;
  id: string;
}

const HEADING_STYLES: Record<DocsHeadingLevel, string> = {
  h1: "max-w-[20ch] text-balance font-doge font-semibold text-3xl tracking-tight sm:text-4xl",
  h2: "font-semibold text-2xl tracking-tight text-balance",
};

export const DocsSectionHeading = ({
  as: Tag = "h2",
  children,
  className,
  id,
}: DocsSectionHeadingProps) => (
  <Tag
    className={cn("group scroll-mt-20", HEADING_STYLES[Tag], className)}
    id={id}
    tabIndex={-1}
  >
    <a
      className="inline rounded-sm text-inherit no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      href={`#${id}`}
    >
      {children}
      <span
        aria-hidden="true"
        className="ml-2 inline-block font-normal text-muted-foreground opacity-0 transition-opacity duration-150 motion-reduce:transition-none group-focus-within:opacity-100 group-hover:opacity-100"
      >
        #
      </span>
      <span className="sr-only"> (link to this section)</span>
    </a>
  </Tag>
);
