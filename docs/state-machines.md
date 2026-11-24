# App state machines

Audit of the app and the shipped Dogecoin payment button. Regression evidence refers to tests in this repository. The pre-fix baseline was commit `92e3b7b` with 66 passing tests.

## Confirmed issues, ordered by impact

| Priority | Issue | Reachable failure and evidence | Resolution and regression coverage |
| --- | --- | --- | --- |
| P1 | Payment detection accepted events outside the active watch | The static preview requested 500,000,000 base units and emitted 50,000,000. The browser entered `appeared` and called the consumer even for an insufficient payment or a different valid address. A timeout for another address also stopped the watch. The transport regression exercises the wrong-address and below-minimum cases before a valid event. | Require the watched address and exact sum of distinct reported receiving outputs to meet the minimum. Discard unrelated or below-threshold events and continue reading. The preview emits 5 DOGE. See [transport tests](../registry/default/dogecoin-payment-button/mempool-watch.test.ts) and the [preview test](../components/docs/preview-payment-button.test.tsx). |
| P1 | Dialog sessions could watch an obsolete address or get stuck on retry | Resolve address A, close, open and resolve B. The old code made watch requests for A, A, B. The watch effect saw the retained payment before the resolution effect published `loading`. Separately, clicking **Try again** could leave the error visible after the close-and-reopen updates, so the success fixture was never reached. An independent resolver `AbortError` was also swallowed while the dialog remained loading. An invalid static amount could throw during rendering, and a malformed watch URL could throw during the watch effect. ADR 0003 also specifies no payment-status UI in Unchecked Mode, which the previous hook ignored. | Scope outcomes to the current opening or configuration, retry resolution in place, and turn input or setup failures into visible errors. Keep payment details accessible on watch setup errors. Suppress the watch for the known-used exhaustion result and subsequent unchecked results. Tests cover those paths and verify a late result cannot change the newer payment or its cursor. See [payment button tests](../registry/default/dogecoin-payment-button/dogecoin-payment-button.test.tsx) and [ADR 0003](adr/0003-unchecked-mode-after-exhaustion.md). |
| P1 | Proxy could retain the provider's single watch slot after cancellation or the deadline | A pending upstream fetch received no deadline before headers. A backpressured downstream held the pump inside `writer.write()` so the timer could settle without releasing upstream. Canceling the response body left upstream un-aborted, and an already-disconnected request still opened upstream and returned 200. An incomplete upstream frame could also consume or precede the proxy timeout as malformed SSE. Deterministic route tests used fake time, an unread body, and a stalled upstream. | One deadline covers both header wait and streaming. Disconnects abort the fetch and cancel/release the reader. The proxy forwards complete frames and can enqueue its terminal event without waiting on downstream demand. Client transport also cancels/releases its reader with signal-ignoring fetch implementations. See [proxy tests](../app/api/dogecoin/mempool/watch/route.test.ts) and [transport tests](../registry/default/dogecoin-payment-button/mempool-watch.test.ts). |
| P2 | Discovery could burst requests, accept invalid provider data, or advance past the public receive chain | Three concurrent default checks started at 0, 350, and 350 ms instead of 0, 350, and 700 ms. A negative `final_n_tx` returned `false` and could yield `verified`. A canceled checker rejecting with an ordinary network error could trigger unchecked fallback. At index 2³¹−1, a used result led the old loop to derive another candidate above the public BIP32 range. The real derivation rejects that index. A valid unchecked resolution at the last index also returned an unusable next cursor. | Recheck spacing on wake, discard canceled work, and require a non-negative integer transaction count. Bound the scan and represent exhaustion explicitly. Validate the cursor before route resolution and carry the HTTP request's cancellation signal into discovery. See [checker tests](../registry/default/dogecoin-payment-button/blockcypher.test.ts), [selection tests](../registry/default/dogecoin-payment-button/address-selection.test.ts), and [resolver route tests](../app/api/dogecoin/resolve-address/route.test.ts). |
| P2 | A valid DOGE amount could disable an otherwise usable watch | The URI accepted `90071992.54740993` DOGE but the converter threw because the base-unit value exceeded JavaScript's safe integer range. | Construct the decimal integer string directly and compare output amounts using BigInt. See [amount conversion tests](../registry/default/dogecoin-payment-button/mempool-watch.test.ts). |
| P2 | Manual installation could select a tab in one group and focus another | Manual mode renders two package-manager groups. Their IDs were identical. ArrowRight from the second group selected its npm tab but focused the first group's npm tab. Panel labels and controls could also resolve to the other group. | Give each group unique IDs and scope keyboard focus to its originating list. File groups use the same instance-scoped approach. See [docs control tests](../components/docs/docs-controls.test.tsx). |
| P2 | Clipboard feedback could report a copy that failed | Both copy buttons set `copied` before calling Clipboard and preserved it on rejection. A denied write could leave an older address or command in the clipboard while the UI reported success. The address test reproduces denial and the docs test covers two writes settling out of order. | Publish feedback after the latest attempt settles, clear it on value change or unmount, and make failures visible and announced. See [payment button tests](../registry/default/dogecoin-payment-button/dogecoin-payment-button.test.tsx) and [docs control tests](../components/docs/docs-controls.test.tsx). |

## Payment dialog and address resolution

[Payment button](../registry/default/dogecoin-payment-button/dogecoin-payment-button.tsx), [resolution hook](../registry/default/dogecoin-payment-button/use-payment-button-state.ts), [dialog rendering](../registry/default/dogecoin-payment-button/payment-button-parts.tsx)

The dialog has an explicit open flag. Resolution has tagged `ready` and `error` outcomes keyed to the current request. The view derives closed, loading, ready, and error from the open flag, source, and current outcome. Both closed and ready use `idle` in the view API.

| From | Event / guard | To | State or side effect |
| --- | --- | --- | --- |
| Closed | Open with a static address | Ready or error | Build the URI with the current amount. An invalid amount shows a configuration error without a retry action. |
| Closed | Open in callback or browser xpub mode | Loading | Start a resolution from the last accepted cursor. |
| Loading | Current request resolves with a valid address and cursor | Ready or payment-details error | Accept the new cursor and derive the URI. |
| Loading | Current request rejects or returns an invalid address or cursor | Error | Show a failure and keep the previous cursor. |
| Resolver error | Try again | Loading | Start a new attempt within the same dialog using the latest accepted cursor. |
| Open | Source or discovery settings change | Loading or static ready/error | Supersede the previous request. A different browser xpub resets the cursor. |
| Ready or payment-details error | Suggested amount changes | Ready or payment-details error | Recompute the URI. If eligible, the watch switches to the new amount. The selection cursor does not advance. |
| Open | Dismiss or unmount | Closed or disposed | Cancel the current owned activity and ignore late async outcomes. |

**Invariants.** Exactly one address source is configured. Only a valid Dogecoin P2PKH address can become a Payment Address. The displayed address and QR use the same resolution, and the QR and watch use the current amount. Stale completions cannot publish results or advance the cursor. Ready in Unchecked Mode can display or copy an address and has no active watch. Stateless callbacks retain their one-argument signature for Server Action compatibility.

## Address selection and provider pacing

[Selector](../registry/default/dogecoin-payment-button/address-selection.ts), [derivation](../registry/default/dogecoin-payment-button/dogecoin.ts), [BlockCypher checker](../registry/default/dogecoin-payment-button/blockcypher.ts), [POST route](../app/api/dogecoin/resolve-address/route.ts)

The selector is an implicit search machine. Its durable cursor is `(startIndex, uncheckedMode)`. Its per-call state includes the current candidate and attempt count. The default step is 19 and the default budget is 20 checks. In the table, `next` is the next stepped index or the exhaustion marker `2³¹`.

| From | Event / guard | To | Result / cursor |
| --- | --- | --- | --- |
| Start | Valid checked cursor | Checking | Derive the starting candidate. Initial cursor is `(0, false)`. |
| Checking | Checker reports unused | Verified | Return the candidate, set cursor to `(index, false)` to recheck next time. |
| Checking | Used and another candidate fits the budget and chain | Checking | Advance one step. |
| Checking | Used and budget or chain exhausted | Exhausted | Return the last known-used candidate and set `(next, true)`. |
| Checking | Provider failure, with an available next index | Transient fallback | Return the unchecked next candidate and set `(next, false)` so discovery resumes next time. |
| Checking | Provider failure, with no next index | Error | Report exhaustion. The caller retains its prior cursor. |
| Start | Valid unchecked cursor with an available candidate | Unchecked | Derive the starting candidate without calling the checker and advance to `(next, true)`. |
| Start | Cursor is `(2³¹, true)` | Exhausted chain | No derivation or checker call. The API returns 422. |
| Start or checking | Cancellation | Canceled | Ignore the result and avoid deriving a fallback. |
| POST | Missing key, invalid JSON/cursor, cancellation, or backend failure | HTTP terminal | Return 503, 400, 499, or 500 respectively. JSON `null` selects the initial cursor. |

**Invariants.** Candidate indices are non-hardened BIP32 indices. The marker is never derived. A checked candidate can become `verified` only after a successful unused observation. The selector never re-enables checking after it enters persistent Unchecked Mode. A validation or transport error does not advance the caller's cursor.

| Pacer state | Event / guard | Next state | Action |
| --- | --- | --- | --- |
| Entered | Less than the configured interval since last admission | Waiting | Sleep for the remainder with an abort listener. |
| Waiting | Timer fires | Entered | Re-evaluate against the shared timestamp before admitting. |
| Entered | Interval elapsed and signal active | Admitted | Record the start timestamp before yielding to the caller. |
| Waiting or entered | Signal canceled | Canceled | Reject without another provider request. |
| Admitted | OK response with a non-negative safe integer count | Used or unused | Return `count > 0`. |
| Admitted | HTTP, network, or payload failure | Failed | Reject so discovery can take its fallback or cancellation path. |

The pacer is shared within each JavaScript runtime. It allows in-flight requests to overlap while spacing their starts. Browser tabs and deployed instances have their own pacers.

## Mempool watch UI and client transport

[Watch hook](../registry/default/dogecoin-payment-button/use-payment-button-state.ts), [watch presentation](../registry/default/dogecoin-payment-button/watch-status.ts), [SSE client](../registry/default/dogecoin-payment-button/mempool-watch.ts)

The UI stores an explicit status for the current watch request. The transport is an implicit one-shot machine with an owned abort controller, optional parent signal, response reader, and terminal guard.

| From | Event / guard | To | Effect |
| --- | --- | --- | --- |
| Idle | Open, current ready payment is watch-eligible, endpoint supplied | Watching / connecting | Include the address and exact base-unit minimum, if specified. |
| Idle or watching | Setup, fetch, read, or payload error | Error | Show the watch failure while keeping the address and QR. |
| Connecting | HTTP 409 | Busy | Report the provider's concurrency limit. |
| Connecting | Accepted response with a body | Reading | Decode complete SSE frames, preserving incomplete data across chunks. |
| Reading | Comment, unrelated event or address, or below-minimum appeared event | Reading | Continue waiting. |
| Reading | Valid matching appeared event reaches the minimum | Appeared | Publish the payload and invoke the current callback once for this session. |
| Reading | Valid matching timeout | Timeout | Show **Watch again**. |
| Reading | EOF before any terminal event | Error | Show a retryable interruption. |
| Busy, timeout, or error | Watch again | Idle → watching | Use a new watch attempt for the current payment. |
| Any | Close, change watch inputs, lose eligibility, or unmount | Closed transport / idle UI | Abort and release the old reader. Ignore events from that request. |

**Invariants.** Only the current request can update the UI or invoke its callback. A transport emits at most one terminal outcome. `appeared` alone carries a transaction payload, and `error` alone carries an error message. A qualifying amount is the sum of the distinct receiving outputs reported for the watched address in that transaction. Catch-up and live events both mean observed in the mempool. Watching does not settle or allocate an invoice.

## SSE proxy and simulated preview

[GET route](../app/api/dogecoin/mempool/watch/route.ts), [OnlyDoge configuration](../lib/onlydoge.ts), [preview transport](../components/docs/preview-mempool.ts)

| From | Event / guard | To | Effect |
| --- | --- | --- | --- |
| Proxy entry | Missing token, invalid input, or already disconnected | HTTP terminal | Return 503, 400, or 499 respectively. |
| Connecting | Upstream returns 409 | Busy | Return HTTP 409 and discard the upstream body. |
| Connecting | Failure, other non-OK status, or missing body | Failed | Return 502 and clear the deadline. |
| Connecting | OK response with body | Streaming | Forward complete frames including heartbeats. Buffer at most the incomplete trailing frame in addition to stream queues. |
| Connecting or streaming | Deadline at 290 seconds from route entry | Timed out | Abort upstream. Return or append one complete timeout event and close downstream. |
| Connecting or streaming | Request disconnects or downstream body is canceled | Canceled | Abort upstream, clear the deadline, and release the reader when present. Return 499 if response headers are still pending. |
| Streaming | Upstream EOF or read failure | Closed or errored | Release reader and deadline. The client handles EOF before a terminal event as an error. |
| Preview idle | Connect to the simulated endpoint | Waiting | Emit a heartbeat and schedule the example transaction after three seconds. |
| Preview waiting | Timer fires first | Appeared / closed | Emit one 5 DOGE output and finish the stream. |
| Preview waiting | Stream canceled first | Canceled | Clear the timer. |

**Invariants.** OnlyDoge owns the one-active-session-per-key policy. The app relays 409 so the caller can retry. Proxy timeout and disconnect both release upstream even with an unread response. A partial upstream frame cannot corrupt the synthetic timeout. The token is used by the server proxy.

## Docs and page state

The remaining app-owned machines are small and mostly synchronous. Browser and library state such as focus guards, scroll positions, media queries, and theme storage follows the corresponding primitive's lifecycle.

| Machine / owner | States | Transition | Invariant |
| --- | --- | --- | --- |
| [Clipboard feedback](../registry/default/dogecoin-payment-button/use-copy-feedback.ts) shared by address and code copy | Idle, pending, copied, error, disposed | Click starts a new attempt and clears the old timer. Latest success or rejection starts a 1.6-second feedback timer. Expiry returns to idle. Value change remounts the control and unmount invalidates pending work. | Success describes a fulfilled clipboard write for the current value. An older promise cannot overwrite newer feedback. |
| [Installation tabs](../components/docs/installation-tabs.tsx) | Command, manual | Click or keyboard navigation selects a mode. Switching modes mounts the selected panel's controls with their defaults. | One mode and its panel are active. The two manual command groups are independent. |
| [Package-manager tabs](../components/docs/package-manager-tabs.tsx) and [file tabs](../components/docs/file-tabs.tsx) | One manager or filename per group. File group can be empty. | Click selects a tab. Arrows wrap relative to the focused tab, Home/End select the endpoints. File input without the stored selection falls back to the first file. | One selected tab and one panel in a nonempty group. Selected tab, keyboard focus after navigation, and ARIA targets stay in the same group. |
| [Code disclosure](../components/docs/code-collapsible-wrapper.tsx) | Collapsed, expanded | Toggle either available trigger. Unmount resets to collapsed. Short snippets skip the disclosure. | The label and maximum height reflect the same open flag. |
| [Desktop table of contents](../components/docs/docs-toc.tsx) | No active heading, or a configured heading ID | Crossing the observer's active band records the last entering heading. Exit-only notifications preserve the last heading, and unmount disconnects the observer. | At most one section link has `aria-current=location`. Mobile uses anchor links with no active-heading state. |
| [Primitive preview URL](../components/docs/primitive-toggle.tsx) | Base UI, Radix UI | Link replaces the `base` query parameter. The server derives the selected label, defaulting to Base UI on missing or unrecognized values. | One preview label is current. Registry installation follows the consuming project's shadcn configuration. |
| [Theme](../components/theme-provider.tsx) and [mode switcher](../components/mode-switcher.tsx) | System preference or explicit light/dark. Effective theme is light/dark, with a pre-hydration unresolved state. | System changes affect system mode. Header button or unmodified D toggles the effective theme to an explicit choice. The shortcut ignores editable controls. | The button and shortcut use the same next-themes provider. Persistence and cross-tab synchronization belong to next-themes. |
| [Homepage live-demo setup](../app/page.tsx) | Setup required, live without watch, live with watch | Each server render checks the configured public key and optional provider token. Invalid or missing key renders setup instructions. Valid key enables the live button, with SSE configured only when a token is present. | The page keeps the configured account key and token on the server. Preview availability is independent of configuration. |

## Concurrency boundaries and verification

- Address selection observes recent usage. Concurrent checkouts can resolve the same unused address, and a later watch can catch up to a transaction already in the mempool. Reuse and catch-up are part of the current product contract. Per-invoice allocation, globally shared rate limiting, transaction deduplication across sessions, and confirmation tracking would require separate state.
- The registry's public resolver callback can be a Server Action. The button can discard a superseded result. A callback that has already started may continue running. The app route honors actual HTTP disconnects. For a resolver backed by a different account under the same callback contract, remount the button to start with a fresh cursor.
- Provider tests use controlled streams, fake clocks, and deferred promises. Live OnlyDoge and BlockCypher behavior is outside this regression run. The tests exercise client and route entry points and use a public fixture account key.
- Registry artifacts under `public/r/` are generated from the implementation and manifest. Rebuild them when changing the shipped files so the manual and CLI installation paths agree.

Verified with `bun run check`, `bun run typecheck`, and `bun run test` (92 tests across 12 files). The generated registry payload matches all 13 manifest source files. The Next.js production build passed with `next build --webpack`. Turbopack could not bind its worker port in this environment.
