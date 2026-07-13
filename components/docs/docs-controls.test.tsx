import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { FileTabs } from "@/components/docs/file-tabs";
import { InstallationTabs } from "@/components/docs/installation-tabs";
import { PackageManagerTabs } from "@/components/docs/package-manager-tabs";
import { PrimitiveToggle } from "@/components/docs/primitive-toggle";

describe("docs controls", () => {
  afterEach(() => {
    cleanup();
  });

  it("switches package-manager install commands", async () => {
    const user = userEvent.setup();
    const commands = {
      bun: "bunx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      npm: "npx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      pnpm: "pnpm dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      yarn: "yarn dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
    };

    render(<PackageManagerTabs commands={commands} />);

    expect(screen.getByRole("tab", { name: "pnpm" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText(commands.pnpm)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "bun" }));
    expect(screen.getByRole("tab", { name: "bun" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText(commands.bun)).toBeInTheDocument();
  });

  it("switches file tabs for integration snippets", async () => {
    const user = userEvent.setup();
    render(
      <FileTabs
        files={[
          {
            code: "export const a = 1;",
            filename: "app/api/dogecoin/resolve-address/route.ts",
          },
          {
            code: "export const GET = async () => new Response();",
            filename: "app/api/dogecoin/mempool/watch/route.ts",
          },
        ]}
      />
    );

    expect(screen.getByText("export const a = 1;")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "resolve-address/route.ts" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "watch/route.ts" }));
    expect(
      screen.getByText("export const GET = async () => new Response();")
    ).toBeInTheDocument();
  });

  it("switches between command and manual installation", async () => {
    const user = userEvent.setup();
    const installCommands = {
      bun: "bunx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      npm: "npx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      pnpm: "pnpm dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      yarn: "yarn dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
    };
    const manualDependencyCommands = {
      bun: "bun add @scure/bip32 @noble/hashes @scure/base uqr lucide-react",
      npm: "npm install @scure/bip32 @noble/hashes @scure/base uqr lucide-react",
      pnpm: "pnpm add @scure/bip32 @noble/hashes @scure/base uqr lucide-react",
      yarn: "yarn add @scure/bip32 @noble/hashes @scure/base uqr lucide-react",
    };
    const manualRegistryCommands = {
      bun: "bunx shadcn@latest add button dialog",
      npm: "npx shadcn@latest add button dialog",
      pnpm: "pnpm dlx shadcn@latest add button dialog",
      yarn: "yarn dlx shadcn@latest add button dialog",
    };

    render(
      <InstallationTabs
        installCommands={installCommands}
        manualDependencyCommands={manualDependencyCommands}
        manualRegistryCommands={manualRegistryCommands}
        sourceFiles={[
          {
            code: "export const DogecoinPaymentButton = () => null;\n",
            filename:
              "components/dogecoin-payment-button/dogecoin-payment-button.tsx",
          },
          {
            code: 'export * from "./dogecoin-payment-button";\n',
            filename: "components/dogecoin-payment-button/index.ts",
          },
        ]}
      />
    );

    expect(screen.getByRole("tab", { name: "Command" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText(installCommands.pnpm)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Manual" }));
    expect(screen.getByRole("tab", { name: "Manual" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText(manualDependencyCommands.pnpm)).toBeInTheDocument();
    expect(screen.getByText(manualRegistryCommands.pnpm)).toBeInTheDocument();
  });

  it("switches manual source files and package managers", async () => {
    const user = userEvent.setup();
    const installCommands = {
      bun: "bunx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      npm: "npx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      pnpm: "pnpm dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      yarn: "yarn dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
    };
    const manualDependencyCommands = {
      bun: "bun add @scure/bip32 @noble/hashes @scure/base uqr lucide-react",
      npm: "npm install @scure/bip32 @noble/hashes @scure/base uqr lucide-react",
      pnpm: "pnpm add @scure/bip32 @noble/hashes @scure/base uqr lucide-react",
      yarn: "yarn add @scure/bip32 @noble/hashes @scure/base uqr lucide-react",
    };
    const manualRegistryCommands = {
      bun: "bunx shadcn@latest add button dialog",
      npm: "npx shadcn@latest add button dialog",
      pnpm: "pnpm dlx shadcn@latest add button dialog",
      yarn: "yarn dlx shadcn@latest add button dialog",
    };

    render(
      <InstallationTabs
        defaultMode="manual"
        installCommands={installCommands}
        manualDependencyCommands={manualDependencyCommands}
        manualRegistryCommands={manualRegistryCommands}
        sourceFiles={[
          {
            code: "export const DogecoinPaymentButton = () => null;\n",
            filename:
              "components/dogecoin-payment-button/dogecoin-payment-button.tsx",
          },
          {
            code: 'export * from "./dogecoin-payment-button";\n',
            filename: "components/dogecoin-payment-button/index.ts",
          },
        ]}
      />
    );

    expect(
      screen.getByText("export const DogecoinPaymentButton = () => null;")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "index.ts" }));
    expect(
      screen.getByText('export * from "./dogecoin-payment-button";')
    ).toBeInTheDocument();

    const [firstBunTab] = screen.getAllByRole("tab", { name: "bun" });
    expect(firstBunTab).toBeDefined();
    if (!firstBunTab) {
      throw new Error("Expected a bun package-manager tab.");
    }
    await user.click(firstBunTab);
    expect(screen.getByText(manualDependencyCommands.bun)).toBeInTheDocument();
  });

  it("marks Base UI as the default selected primitive", () => {
    render(<PrimitiveToggle value="base-ui" />);
    expect(screen.getByRole("link", { name: "Base UI" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Radix UI" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("marks Radix UI when selected", () => {
    render(<PrimitiveToggle value="radix" />);
    expect(screen.getByRole("link", { name: "Radix UI" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Base UI" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("supports arrow-key navigation between package manager tabs", async () => {
    const user = userEvent.setup();
    const commands = {
      bun: "bunx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      npm: "npx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      pnpm: "pnpm dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
      yarn: "yarn dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json",
    };

    render(<PackageManagerTabs commands={commands} />);

    const pnpmTab = screen.getByRole("tab", { name: "pnpm" });
    pnpmTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "npm" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText(commands.npm)).toBeInTheDocument();
  });
});
