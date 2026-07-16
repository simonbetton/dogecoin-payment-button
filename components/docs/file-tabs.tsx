"use client";

import * as React from "react";

import { CodeBlockFigure } from "@/components/docs/code-block-figure";
import { CodeCollapsibleWrapper } from "@/components/docs/code-collapsible-wrapper";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createTabListKeyDownHandler } from "@/lib/tab-list";
import { cn } from "@/lib/utils";

const COLLAPSIBLE_LINE_THRESHOLD = 16;

export interface CodeFile {
  code: string;
  filename: string;
  highlightedCode?: string;
  language?: string;
}

interface FileTabsProps {
  className?: string;
  collapsible?: boolean;
  defaultValue?: string;
  files: CodeFile[];
}

const basename = (filename: string): string =>
  filename.split("/").at(-1) ?? filename;

const buildTabLabels = (files: CodeFile[]): Map<string, string> => {
  const labels = new Map<string, string>();
  const basenameCounts = new Map<string, number>();

  for (const file of files) {
    const name = basename(file.filename);
    basenameCounts.set(name, (basenameCounts.get(name) ?? 0) + 1);
  }

  for (const file of files) {
    const name = basename(file.filename);
    if ((basenameCounts.get(name) ?? 0) > 1) {
      const parts = file.filename.split("/");
      labels.set(
        file.filename,
        parts.length >= 2 ? parts.slice(-2).join("/") : file.filename
      );
      continue;
    }
    labels.set(file.filename, name);
  }

  return labels;
};

const toFileTabId = (filename: string): string =>
  `file-tab-${filename.replaceAll(/[^a-zA-Z0-9_-]/gu, "-")}`;

const toFilePanelId = (filename: string): string =>
  `file-panel-${filename.replaceAll(/[^a-zA-Z0-9_-]/gu, "-")}`;

export const FileTabs = ({
  className,
  collapsible = false,
  defaultValue,
  files,
}: FileTabsProps) => {
  const filenames = React.useMemo(
    () => files.map((file) => file.filename),
    [files]
  );
  const initial = defaultValue ?? files[0]?.filename ?? "";
  const [value, setValue] = React.useState(initial);
  const active = files.find((file) => file.filename === value) ?? files[0];
  const tabLabels = React.useMemo(() => buildTabLabels(files), [files]);
  const handleKeyDown = React.useMemo(
    () =>
      createTabListKeyDownHandler({
        getTabElementId: toFileTabId,
        onSelect: setValue,
        value: active?.filename ?? "",
        values: filenames,
      }),
    [active?.filename, filenames]
  );

  if (!active) {
    return null;
  }

  const shouldCollapse =
    collapsible && active.code.split("\n").length > COLLAPSIBLE_LINE_THRESHOLD;

  const figure = (
    <CodeBlockFigure
      code={active.code}
      filename={active.filename}
      highlightedCode={active.highlightedCode}
      language={active.language}
    />
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ScrollArea className="w-full rounded-lg border bg-muted/40">
        <div
          aria-label="Source files"
          className="flex w-max min-w-full gap-1 p-1"
          role="tablist"
        >
          {files.map((file) => {
            const selected = file.filename === active.filename;
            const label = tabLabels.get(file.filename) ?? file.filename;
            return (
              <button
                aria-controls={toFilePanelId(file.filename)}
                aria-selected={selected}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                id={toFileTabId(file.filename)}
                key={file.filename}
                onClick={() => {
                  setValue(file.filename);
                }}
                onKeyDown={handleKeyDown}
                role="tab"
                tabIndex={selected ? 0 : -1}
                title={file.filename}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </ScrollArea>
      <div
        aria-labelledby={toFileTabId(active.filename)}
        id={toFilePanelId(active.filename)}
        role="tabpanel"
        tabIndex={0}
      >
        {shouldCollapse ? (
          <CodeCollapsibleWrapper>{figure}</CodeCollapsibleWrapper>
        ) : (
          figure
        )}
      </div>
    </div>
  );
};
