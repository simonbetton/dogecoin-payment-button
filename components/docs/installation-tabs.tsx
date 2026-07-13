"use client";

import * as React from "react";

import type { CodeFile } from "@/components/docs/file-tabs";
import { FileTabs } from "@/components/docs/file-tabs";
import { PackageManagerTabs } from "@/components/docs/package-manager-tabs";
import type { PackageManager } from "@/lib/docs";
import { DEFAULT_PACKAGE_MANAGER } from "@/lib/docs";
import { createTabListKeyDownHandler } from "@/lib/tab-list";
import { cn } from "@/lib/utils";

export type InstallationMode = "cli" | "manual";

interface InstallationTabsProps {
  className?: string;
  defaultMode?: InstallationMode;
  defaultPackageManager?: PackageManager;
  highlightedInstallCommands?: Partial<Record<PackageManager, string>>;
  highlightedManualDependencyCommands?: Partial<Record<PackageManager, string>>;
  highlightedManualRegistryCommands?: Partial<Record<PackageManager, string>>;
  installCommands: Record<PackageManager, string>;
  manualDependencyCommands: Record<PackageManager, string>;
  manualRegistryCommands: Record<PackageManager, string>;
  sourceFiles: CodeFile[];
}

const INSTALLATION_MODES = [
  "cli",
  "manual",
] as const satisfies readonly InstallationMode[];

const getModeTabId = (mode: InstallationMode): string =>
  `installation-mode-${mode}`;

const getModePanelId = (mode: InstallationMode): string =>
  `installation-mode-panel-${mode}`;

const ModeTabs = ({
  value,
  onChange,
}: {
  onChange: (mode: InstallationMode) => void;
  value: InstallationMode;
}) => {
  const handleKeyDown = React.useMemo(
    () =>
      createTabListKeyDownHandler({
        getTabElementId: getModeTabId,
        onSelect: onChange,
        value,
        values: INSTALLATION_MODES,
      }),
    [onChange, value]
  );

  return (
    <div
      aria-label="Installation method"
      className="flex gap-1 rounded-lg border bg-muted/40 p-1"
      role="tablist"
    >
      {(
        [
          { label: "Command", value: "cli" },
          { label: "Manual", value: "manual" },
        ] as const
      ).map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            aria-controls={getModePanelId(tab.value)}
            aria-selected={selected}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            id={getModeTabId(tab.value)}
            key={tab.value}
            onClick={() => {
              onChange(tab.value);
            }}
            onKeyDown={handleKeyDown}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export const InstallationTabs = ({
  className,
  defaultMode = "cli",
  defaultPackageManager = DEFAULT_PACKAGE_MANAGER,
  highlightedInstallCommands,
  highlightedManualDependencyCommands,
  highlightedManualRegistryCommands,
  installCommands,
  manualDependencyCommands,
  manualRegistryCommands,
  sourceFiles,
}: InstallationTabsProps) => {
  const [mode, setMode] = React.useState<InstallationMode>(defaultMode);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ModeTabs onChange={setMode} value={mode} />

      {mode === "cli" ? (
        <div
          aria-labelledby={getModeTabId("cli")}
          className="space-y-3"
          id={getModePanelId("cli")}
          role="tabpanel"
          tabIndex={0}
        >
          <PackageManagerTabs
            commands={installCommands}
            defaultValue={defaultPackageManager}
            highlightedCommands={highlightedInstallCommands}
          />
        </div>
      ) : (
        <div
          aria-labelledby={getModeTabId("manual")}
          className="space-y-6"
          id={getModePanelId("manual")}
          role="tabpanel"
          tabIndex={0}
        >
          <ol className="space-y-6">
            <li className="space-y-3">
              <p className="font-medium text-sm">
                <span className="mr-2 text-muted-foreground">1.</span>
                Install the following dependencies:
              </p>
              <PackageManagerTabs
                commands={manualDependencyCommands}
                defaultValue={defaultPackageManager}
                highlightedCommands={highlightedManualDependencyCommands}
              />
            </li>

            <li className="space-y-3">
              <p className="font-medium text-sm">
                <span className="mr-2 text-muted-foreground">2.</span>
                Add the required shadcn components:
              </p>
              <PackageManagerTabs
                commands={manualRegistryCommands}
                defaultValue={defaultPackageManager}
                highlightedCommands={highlightedManualRegistryCommands}
              />
            </li>

            <li className="space-y-3">
              <p className="font-medium text-sm">
                <span className="mr-2 text-muted-foreground">3.</span>
                Copy and paste the following code into your project.
              </p>
              <FileTabs collapsible files={sourceFiles} />
            </li>

            <li className="space-y-2">
              <p className="font-medium text-sm">
                <span className="mr-2 text-muted-foreground">4.</span>
                Update the import paths to match your project setup.
              </p>
              <p className="text-muted-foreground text-sm">
                Files are intended for{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  components/dogecoin-payment-button/
                </code>
                . Keep{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  button
                </code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  dialog
                </code>{" "}
                imports aligned with your{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  components.json
                </code>{" "}
                aliases.
              </p>
            </li>
          </ol>
        </div>
      )}
    </div>
  );
};
