# Dogecoin Payment Button

Installable [shadcn](https://ui.shadcn.com/docs/registry/getting-started) registry block that turns a dedicated Dogecoin BIP44 account public key into a “Send me Dogecoin” button.

The button opens a dialog with:

- a payment QR code
- the Dogecoin address
- a copy control with a “Copied” animation
- an optional suggested DOGE amount
- optional one-shot mempool watching for incoming payments

## Why a registry block?

Developers install the source into their app and can modify derivation, UI, and the Address Usage Checker. This is not a sealed npm package.

```bash
pnpm dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json
npx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json
yarn dlx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json
bunx shadcn@latest add http://localhost:3000/r/dogecoin-payment-button.json
```

After deploy, replace the host with your registry URL.

## Setup

1. Create a **dedicated** Dogecoin account at `m/44'/3'/0'`.
2. Export the account public key as `dgub` (Dogecoin-native) or `xpub` (Bitcoin-compatible).
3. Set it in the environment:

```bash
DOGECOIN_XPUB=dgub...
```

Do not reuse a general wallet account. Anyone who can derive from the account public key can watch the receive chain.

### Optional mempool watching

To detect unconfirmed receiving payments with OnlyDoge:

```bash
ONLYDOGE_API_TOKEN=sk_...
ONLYDOGE_API_BASE_URL=https://platform.onlydoge.io
```

Keep the token server-side. This repo’s demo proxies SSE through `/api/dogecoin/mempool/watch` so the browser never sees the credential.

## Recommended integration (server-first)

Keep the account public key on the server and resolve on every modal open via a Route Handler (see `app/api/dogecoin/resolve-address/route.ts` in this repo):

```tsx
"use client";

import { DogecoinPaymentButton } from "@/components/dogecoin-payment-button";
import type {
  AddressSelectionResult,
  DogecoinPaymentResolveFn,
  SelectionState,
} from "@/components/dogecoin-payment-button";

const resolvePaymentAddress: DogecoinPaymentResolveFn = async (
  state: SelectionState
): Promise<AddressSelectionResult> => {
  const response = await fetch("/api/dogecoin/resolve-address", {
    body: JSON.stringify(state),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to resolve a Dogecoin payment address.");
  }

  return (await response.json()) as AddressSelectionResult;
};

export function DonateButton() {
  return (
    <DogecoinPaymentButton
      amount="10"
      mempoolWatch={{ endpoint: "/api/dogecoin/mempool/watch" }}
      onPaymentAppeared={(payment) => {
        console.log("seen in mempool", payment.txid);
      }}
      resolveAddress={resolvePaymentAddress}
    />
  );
}
```

## Other modes

### Pre-resolved address

```tsx
<DogecoinPaymentButton address="DCm7oSg95sxwn3sWxYUDHgKKbB2mDmuR3B" />
```

### Browser derivation (privacy trade-off)

```tsx
<DogecoinPaymentButton
  amount="5"
  xpub={process.env.NEXT_PUBLIC_DOGECOIN_XPUB!}
/>
```

Prefer the server path. Browser mode exposes the Account Public Key to visitors.

## Address discovery

Defaults:

- `addressIndexStep = 19`
- `maxAttempts = 20`

Sequence from index `0`: `0, 19, 38, …, 361`.

- Unused addresses are reused until they become used.
- Provider errors fall back to the next unchecked index for that opening, then retry discovery later.
- After 20 used results, the component displays the known-used final candidate and enters **Unchecked Mode**: later openings increment without usage checks.

Swap the backend by passing a custom `AddressUsageChecker` (or editing the shipped BlockCypher implementation). Checks use `fetch` only and work in browsers.

## Mempool watching

Opt in with `mempoolWatch.endpoint`. When a payment address is shown:

1. The client opens a one-shot SSE watch for that address.
2. If `amount` is set, it is converted exactly to `minValueBase` (`1 DOGE = 100000000`).
3. Only **receiving** outputs are watched (someone sending to the address), not spends.
4. On connect, OnlyDoge catch-up-scans the current mempool; an existing match appears immediately.
5. The first qualifying `mempool.watch.appeared` event marks the payment as **seen in mempool** (not confirmed) and invokes `onPaymentAppeared`.
6. If nothing qualifies within 5 minutes, `mempool.watch.timeout` expires the wait; the user can start a new session with **Watch again**.
7. Only one concurrent watch session is allowed per OnlyDoge API key (`409` busy). Heartbeats/comments are ignored.

Confirmation still requires polling existing explorer address/tx routes after an appear event.

## Local development

```bash
bun install
bun run dev
bun run test
bun run typecheck
bun run lint
bun run registry:build
```

Tooling:

- Bun
- TypeScript via `tsgo --noEmit`
- Oxlint + Oxfmt through Ultracite presets

## License

MIT
