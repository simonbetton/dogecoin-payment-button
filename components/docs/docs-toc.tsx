"use client";

import * as React from "react";

import { DOC_SECTIONS } from "@/lib/docs";
import { cn } from "@/lib/utils";

interface DocsTocProps {
  className?: string;
}

const useActiveItem = (itemIds: readonly string[]) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "0% 0% -80% 0%" }
    );

    for (const id of itemIds) {
      const element = document.querySelector(`#${CSS.escape(id)}`);
      if (element) {
        observer.observe(element);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [itemIds]);

  return activeId;
};

export const DocsToc = ({ className }: DocsTocProps) => {
  const itemIds = React.useMemo(
    () => DOC_SECTIONS.map((section) => section.id),
    []
  );
  const activeHeading = useActiveItem(itemIds);

  return (
    <nav
      aria-label="On this page"
      className={cn("flex flex-col gap-2 p-4 pt-0 text-sm", className)}
    >
      <p
        className="bg-background text-muted-foreground h-6 text-xs font-medium"
        id="on-this-page-heading"
      >
        On This Page
      </p>
      <ul
        aria-labelledby="on-this-page-heading"
        className="flex flex-col gap-2"
      >
        {DOC_SECTIONS.map((section) => {
          const isActive = section.id === activeHeading;
          return (
            <li key={section.id}>
              <a
                aria-current={isActive ? "location" : undefined}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 data-[active=true]:text-foreground block rounded-sm text-[0.8rem] no-underline transition-colors outline-none focus-visible:ring-3 data-[active=true]:font-medium"
                data-active={isActive}
                href={section.href}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
