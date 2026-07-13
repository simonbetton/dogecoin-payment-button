"use client";

import * as React from "react";

import { CodeBlockFigure } from "@/components/docs/code-block-figure";
import type { PackageManager } from "@/lib/docs";
import { DEFAULT_PACKAGE_MANAGER, PACKAGE_MANAGERS } from "@/lib/docs";
import { createTabListKeyDownHandler } from "@/lib/tab-list";
import { cn } from "@/lib/utils";

interface PackageManagerTabsProps {
  className?: string;
  commands: Record<PackageManager, string>;
  defaultValue?: PackageManager;
  highlightedCommands?: Partial<Record<PackageManager, string>>;
}

const getPackageManagerTabId = (manager: PackageManager): string =>
  `package-manager-${manager}`;

const getPackageManagerPanelId = (manager: PackageManager): string =>
  `package-manager-panel-${manager}`;

export const PackageManagerTabs = ({
  className,
  commands,
  defaultValue = DEFAULT_PACKAGE_MANAGER,
  highlightedCommands,
}: PackageManagerTabsProps) => {
  const [value, setValue] = React.useState<PackageManager>(defaultValue);
  const command = commands[value];
  const handleKeyDown = React.useMemo(
    () =>
      createTabListKeyDownHandler({
        getTabElementId: getPackageManagerTabId,
        onSelect: setValue,
        value,
        values: PACKAGE_MANAGERS,
      }),
    [value]
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        aria-label="Package manager"
        className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        role="tablist"
      >
        {PACKAGE_MANAGERS.map((manager) => {
          const selected = manager === value;
          return (
            <button
              aria-controls={getPackageManagerPanelId(manager)}
              aria-selected={selected}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "bg-background text-foreground shadow-sm dark:shadow-none"
                  : "text-muted-foreground hover:text-foreground"
              )}
              id={getPackageManagerTabId(manager)}
              key={manager}
              onClick={() => {
                setValue(manager);
              }}
              onKeyDown={handleKeyDown}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {manager}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={getPackageManagerTabId(value)}
        id={getPackageManagerPanelId(value)}
        role="tabpanel"
        tabIndex={0}
      >
        <CodeBlockFigure
          code={command}
          highlightedCode={highlightedCommands?.[value]}
          language="bash"
        />
      </div>
    </div>
  );
};
