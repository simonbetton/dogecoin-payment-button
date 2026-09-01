import Image from "next/image";
import Link from "next/link";

import { DocsToc } from "@/components/docs/docs-toc";
import { GitHubLink } from "@/components/github-link";
import { ModeSwitcher } from "@/components/mode-switcher";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DOC_SECTIONS } from "@/lib/docs";

const sectionLinkClassName =
  "shrink-0 rounded-md bg-muted/50 px-2.5 py-1.5 text-muted-foreground text-sm no-underline outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

export const DocsHeader = () => (
  <header className="bg-background/90 sticky top-0 z-50 w-full border-b backdrop-blur-sm">
    <div className="flex h-14 w-full items-center gap-4 px-4 sm:px-6">
      <div className="flex items-center md:flex-1">
        <Link
          aria-label="Homepage"
          className="font-doge text-md focus-visible:ring-ring/50 inline-flex items-center gap-2 rounded-sm font-semibold tracking-tight outline-none focus-visible:ring-3"
          href="/"
        >
          <Image
            alt=""
            className="size-6 rounded-sm"
            height={24}
            src="/apple-icon-57x57.png"
            width={24}
          />
          Dogecoin Payment Button
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2">
        <Link
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 hidden rounded-sm text-sm transition-colors outline-none focus-visible:ring-3 sm:inline"
          href="/r/dogecoin-payment-button.json"
          rel="noopener noreferrer"
          target="_blank"
        >
          Registry JSON
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
        <Separator
          className="mx-1 hidden h-4 self-center! sm:block"
          orientation="vertical"
        />
        <GitHubLink />
        <Separator className="mx-1 h-4 self-center!" orientation="vertical" />
        <ModeSwitcher />
      </div>
    </div>
    <nav aria-label="Page sections" className="border-t lg:hidden">
      <ScrollArea className="w-full">
        <div className="flex w-max gap-3 px-4 py-2 sm:px-6">
          {DOC_SECTIONS.map((section) => (
            <Link
              className={sectionLinkClassName}
              href={section.href}
              key={section.id}
            >
              {section.label}
            </Link>
          ))}
        </div>
      </ScrollArea>
    </nav>
  </header>
);

export const DocsSidebar = () => (
  <aside
    aria-label="Table of contents"
    className="sticky top-14 z-30 col-start-3 hidden h-[calc(100dvh-3.5rem)] w-56 flex-col gap-4 justify-self-end overflow-hidden overscroll-none pb-8 xl:flex"
  >
    <ScrollArea className="scroll-fade min-h-0 flex-1">
      <div className="flex flex-col gap-8 px-4 pt-8">
        <DocsToc />
      </div>
    </ScrollArea>
  </aside>
);
