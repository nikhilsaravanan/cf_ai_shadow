# plan.md — Shadow (`cf_ai_shadow`) execution plan

This file is the **single source of truth for execution**. Nothing gets built, installed, renamed, or committed unless it is a step in this document. If a decision comes up mid-build that is not covered here, stop and amend this plan first.

Scope/features come from `PRD.md` (authoritative). Build rails and conventions come from `CLAUDE.md`. This plan bridges the two into ordered, verifiable steps.

---

## 0. Pinned decisions (already aligned with the user)

- **Repo layout:** flat. One git repo at `cf_ai_shadow/`. All graded artifacts (`PRD.md`, `CLAUDE.md`, `PROMPTS.md`, `README.md`, `plan.md`, `shadow-check.md`) live inside it. The existing `chat-agent/` directory gets renamed to `cf_ai_shadow/` and the root-level docs move in.
- **Starter approach:** keep the existing blank "Hello World" Workers starter (`chat-agent/`) and build up from it by following the [Build a chat agent](https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/) guide. Do **not** re-scaffold from `cloudflare/agents-starter` — we already have a clean git repo with one "Initial commit".
- **Deploy target:** single Worker with `assets` binding serving the Vite/React build. **No Cloudflare Pages project.** Any doc language referencing Pages must be rewritten at M10/M11.
- **LLM:** Workers AI, model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- **Chat stack (from the guide):** `@cloudflare/ai-chat` (`AIChatAgent`, `useAgentChat` from `@cloudflare/ai-chat/react`) + `agents` (`Agent`, `routeAgentRequest`, `useAgent` from `agents/react`) + `ai` (`streamText`, `convertToModelMessages`, `tool`, `stepCountIs`) + `workers-ai-provider` (`createWorkersAI`) + `zod`.
- **Chain client:** `viem` (mainnet only).
- **Bindings (canonical names):** `AI` (Workers AI), `ChatAgent` (DO → `ChatAgent`; renamed to `ResearcherAgent` in M8 via a `renamed_classes` migration — binding key renames with the class), `WalletAgent` (DO → `WalletAgent`), `IngestWorkflow` (Workflow → `IngestWorkflow`), `ABI_CACHE` (KV). **Convention:** DO / Workflow binding `name` matches its `class_name` so `routeAgentRequest` kebab-matches URLs like `/agents/wallet-agent/<addr>`. KV / AI bindings stay uppercase. *(Deviation from original plan §0, which said `WALLET`/`RESEARCHER`/`INGEST`; aligned with Agents-SDK routing docs and M1's actual `ChatAgent` binding.)*
- **DO naming:** `ResearcherAgent` name = `"default"` (MVP singleton). `WalletAgent` name = `address.toLowerCase()`.
- **Secrets:** `ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY` via `wrangler secret put`.
- **tsconfig.json:** `target: ES2022` or newer (current `es2024` is fine; CLAUDE.md's "ES2022 / ES2021" wording will be relaxed to "ES2022+" during M0).
- **Decorators:** TC39 syntax. Do **not** enable `experimentalDecorators`.
- **Pre-commit verification:** `/shadow-check` at each milestone boundary. No skipping.
- **Real `wrangler deploy`:** forbidden until M10. Every intermediate check is `--dry-run`.

## 0a. Open items to resolve at their milestone (not blockers right now)

- **M6 — Workflow base class.** PRD calls it `AgentWorkflow`; the current docs show `WorkflowEntrypoint` from `cloudflare:workers` with a `workflows` binding in `wrangler.jsonc`. Decision deferred to M6: confirm via `cloudflare-docs` MCP which is current, then pin it in CLAUDE.md.
- **M9 — Frontend build tooling.** Either (a) `@cloudflare/vite-plugin` (Vite plugin that builds client + Worker together, emits wrangler.json at build time), or (b) plain Vite build → `./dist` + manual `assets.directory` in wrangler.jsonc. Decide at M9 start; prefer (a) for simplicity if it supports DO + Workers AI bindings cleanly.
- **M4 — Classification reliability fallback.** If Llama 3.3 structured output is flaky, fall back to `@cf/meta/llama-3.1-8b-instruct` for classification only. Decide after first run of batched classification.

## 0b. Source-of-truth references

- Chat-agent guide: https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/
- Agents SDK overview: https://developers.cloudflare.com/agents/
- Chat agents API reference: https://developers.cloudflare.com/agents/api-reference/chat-agents/
- Client SDK (useAgent / useAgentChat): https://developers.cloudflare.com/agents/api-reference/client-sdk/
- Static assets (Worker+SPA): https://developers.cloudflare.com/workers/static-assets/
- SPA shell example: https://developers.cloudflare.com/workers/examples/spa-shell/
- viem: https://viem.sh
- **Lookup rule (from CLAUDE.md):** Cloudflare topics → `cloudflare-docs` MCP. Third-party libs → `ctx7` CLI. Do not use web search for Cloudflare topics.

---

## M0 — Flatten layout + align CLAUDE.md

**Goal:** End M0 with one repo at `cf_ai_shadow/` containing all graded artifacts, and a CLAUDE.md that accurately reflects the pinned decisions above.

**Pre-conditions:**
- No uncommitted work in `chat-agent/` (git log currently shows only the create-cloudflare "Initial commit"; verify).
- User has approved this plan.md.

**Steps:**
1. From project root, rename `chat-agent/` → `cf_ai_shadow/`.
2. Move root-level docs into the repo: `PRD.md`, `CLAUDE.md`, `PROMPTS.md`, `shadow-check.md`, and this `plan.md` move to `cf_ai_shadow/`. Leave nothing at `/Users/nikhilsaravanan/Cloudflare Project/` except the repo folder. (We may delete the now-empty parent directory later; not required.)
3. Move `shadow-check.md` into `cf_ai_shadow/.claude/commands/shadow-check.md` so it's actually wired as a project slash command. Create the `.claude/commands/` directory first.
4. Update `cf_ai_shadow/package.json` `name` field to `cf_ai_shadow`.
5. Update `cf_ai_shadow/wrangler.jsonc` `name` to `cf_ai_shadow`.
6. Delete `cf_ai_shadow/AGENTS.md` (generic, partially contradicts CLAUDE.md).
7. Edit `CLAUDE.md`:
   - Add a **Working directory** note: repo root is `cf_ai_shadow/`; all commands run from there.
   - Correct the stack section: the installed starter is the blank Workers scaffold, and the Agents SDK + React deps get added in M1 by following the chat-agent guide. Record exact import paths: `AIChatAgent` from `@cloudflare/ai-chat`, `useAgentChat` from `@cloudflare/ai-chat/react`, `useAgent` from `agents/react`, `routeAgentRequest` from `agents`. (CLAUDE.md currently says both `useAgent` and `useAgentChat` come from `agents/react` — that's wrong.)
   - Relax the tsconfig rule to "`target`: ES2022 or newer".
   - Add a one-line note disambiguating `AgentWorkflow` (PRD shorthand) vs `WorkflowEntrypoint` (actual class). Final decision at M6.
   - Replace the "Frontend: Cloudflare Pages" language with "Frontend: single Worker + `assets` binding serving the Vite build."
   - Note that `npm run cf-typegen` is equivalent to `npx wrangler types`; either works in `/shadow-check`.
8. Add a `README.md` stub at `cf_ai_shadow/README.md` with just the one-line description + "under construction" marker. Full README gets written at M11.
9. Run `/shadow-check` from inside `cf_ai_shadow/`. Expectation: types pass (trivial), tests pass (starter test), wrangler dry-run passes. Any skipped step is acceptable at this point (e.g. no lint config → skip).
10. Append M0 entries to `PROMPTS.md` under `## M0 — Planning (pre-scaffold)` and a new `## M1-prep` section if any new meta-prompts were issued. At minimum log the user's two messages in this exchange verbatim (the initial assignment message and the "you can follow the documentation..." reply) under `## M0 — Planning`.
11. `git add -A && git commit -m "M0: flatten layout, align CLAUDE.md to chat-agent guide and Worker+assets deploy"`.

**Verification:**
- `ls cf_ai_shadow/` shows: `PRD.md`, `CLAUDE.md`, `PROMPTS.md`, `plan.md`, `README.md`, `.claude/commands/shadow-check.md`, `src/`, `test/`, `wrangler.jsonc`, `package.json`, `tsconfig.json`, `node_modules/`, `.git/`, etc.
- `git -C cf_ai_shadow log --oneline` shows 2 commits (initial + M0).
- `/shadow-check` passes (skipped steps allowed).

---

## M1 — Agents SDK scaffold: minimal ChatAgent talking to Llama 3.3

**Goal:** A working `npm run dev` where a WebSocket chat through `ChatAgent` streams Llama 3.3 responses. No Shadow-specific logic yet — this proves the Agents SDK wiring.

**Pre-conditions:** M0 complete.

**Steps (follow the Cloudflare chat-agent guide):**
1. In `cf_ai_shadow/`, install: `npm install agents @cloudflare/ai-chat ai workers-ai-provider zod`.
2. Rename `src/index.ts` → `src/server.ts` (per the guide) and replace its contents with a minimal `AIChatAgent`:
   - Class name: `ChatAgent` (temporary; becomes `ResearcherAgent` in M8).
   - `onChatMessage` uses `createWorkersAI({ binding: this.env.AI })` and `streamText` against `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Return `result.toUIMessageStreamResponse()`.
   - Default export: a `fetch` handler that delegates to `routeAgentRequest(request, env)` and falls back to 404.
3. Update `wrangler.jsonc`:
   - `main`: `src/server.ts`
   - `ai`: `{ "binding": "AI" }`
   - `durable_objects.bindings`: `[{ "name": "ChatAgent", "class_name": "ChatAgent" }]`
   - `migrations`: `[{ "tag": "v1", "new_sqlite_classes": ["ChatAgent"] }]`
   - Keep `compatibility_date: "2026-04-23"` and `compatibility_flags: ["nodejs_compat"]`.
4. Run `npx wrangler types` to regenerate `worker-configuration.d.ts` for the new bindings.
5. Update `test/index.spec.ts` to import `server.ts` (or delete it for now; the Hello World test no longer applies). Prefer minimal edit: rename path, adjust the assertions to check routeAgentRequest fallback returns 404 for `/`.
6. ~~`npm run dev` and confirm a manual WebSocket connection to `/agents/chat-agent/default` streams text.~~ **Deviation (M1):** deferred to M9. A real Workers AI inference bills even in local dev (explicit warning on `wrangler dev` startup), and a hand-rolled WebSocket client is throwaway work right before M9's UI lands. Unit tests + dry-run + strict type-check cover the wiring.
7. Run `/shadow-check`. Expectation: types pass, tests pass, wrangler dry-run passes.
8. Append M1 block to `PROMPTS.md`: meta-prompts (user messages that drove this milestone) + application prompts (system prompt used in `streamText`, verbatim).
9. `git add -A && git commit -m "M1: ChatAgent scaffold streaming Llama 3.3 over WebSocket"`.

**Verification:**
- `/shadow-check` green.
- Live WebSocket streaming smoke check moved to M9 (see step 6).

---

## M2 — `WalletAgent` skeleton

**Goal:** `WalletAgent` class exists as a separate DO, has state and SQLite migrations, exposes stub `@callable` methods returning fixture data. Not yet wired to the UI; verified by a one-shot script.

**Pre-conditions:** M1 green.

**Steps:**
1. Create `src/walletAgent.ts` with:
   - `class WalletAgent extends Agent<Env, WalletState>` where `WalletState` is per PRD §11 (`address`, `lastSyncedBlock`, `dossier`, `txCount`, `updatedAt`). Initial `dossier` is a hardcoded fixture until M5.
   - SQLite migrations for `transactions` and `counterparties` tables per PRD §6.2. Run them in `onStart` (or equivalent lifecycle hook — verify via `cloudflare-docs` MCP before writing).
   - `@callable()` methods: `initialize(address)`, `refresh()` (no-op), `getDossier()`, `getRecentActivity(limit)`, `getTxByHash(hash)`. Stubs return hardcoded data.
2. Wire `WalletAgent` into `wrangler.jsonc`:
   - Add DO binding `WALLET` → `WalletAgent`.
   - Add to `migrations` with `new_sqlite_classes: ["WalletAgent"]` (or append to v1 if not yet deployed). Consult docs before picking.
3. Export `WalletAgent` from `server.ts` so the Worker runtime picks it up.
4. Write a one-shot verification script `scripts/verify-wallet-agent.ts` (or a vitest integration test) that: (a) spins up the Worker, (b) calls `env.WALLET.idFromName("0xd8da6bf26964af9d7eed9e03e53415d37aa96045").get(...).initialize("0xd8da...")`, (c) calls `getDossier()` and asserts the fixture shape.
5. Run `npx wrangler types`, then `/shadow-check`. Vitest suite should now include the WalletAgent smoke test.
6. Append M2 block to `PROMPTS.md`.
7. `git add -A && git commit -m "M2: WalletAgent DO skeleton with fixture dossier + SQLite migrations"`.

**Verification:**
- `/shadow-check` green.
- `npx vitest run` shows the WalletAgent smoke test passing.

---

## M3 — Transaction ingestion (no LLM)

**Goal:** `WalletAgent.refresh()` actually fetches and decodes txs from Alchemy + Etherscan and writes them to SQLite. Still no LLM.

**Pre-conditions:** M2 green; `ALCHEMY_API_KEY` and `ETHERSCAN_API_KEY` available to local dev via `.dev.vars`.

**Steps:**
1. `npm install viem`.
2. Add KV binding `ABI_CACHE` to `wrangler.jsonc`. Create the KV namespace via `cloudflare-api` MCP (not by hand) and paste the id into `wrangler.jsonc` under `kv_namespaces`.
3. Set secrets locally: create `.dev.vars` (git-ignored already per starter) with `ALCHEMY_API_KEY=...` and `ETHERSCAN_API_KEY=...`.
4. Create `src/ingest/fetchTxs.ts`: Alchemy `alchemy_getAssetTransfers` wrapper, returns up to 200 txs. Retry once on 429.
5. Create `src/ingest/decodeTxs.ts`: for each tx `to`, fetch ABI from Etherscan (with 7-day KV cache via `ABI_CACHE`), use `viem`'s `decodeFunctionData` to produce decoded input. Tag unknowns as `unknown_contract`.
6. In `WalletAgent.refresh()`, call fetch → decode → write rows into `transactions` and `counterparties`. Update `state.lastSyncedBlock`, `state.txCount`, `state.updatedAt`.
7. Extend the M2 smoke test (or add a new one) that exercises `refresh()` against a pinned test address (e.g. Vitalik's). Guard behind `INTEGRATION=1` env var so CI-ish runs of `/shadow-check` don't hit Alchemy.
8. Run `/shadow-check` (no integration env; fast path) → green.
9. Manually run the integration smoke test once, paste result into the commit message.
10. Append M3 block to `PROMPTS.md` (any design prompts issued during build).
11. `git add -A && git commit -m "M3: tx ingestion (Alchemy + Etherscan + KV-cached ABIs) into WalletAgent SQLite"`.

**Verification:**
- `/shadow-check` green.
- Integration test: `INTEGRATION=1 npx vitest run` fetches txs for Vitalik's wallet and persists ≥10 rows.

---

## M4 — Classify txs with Llama 3.3

**Goal:** Every tx row gets a `classification` column populated with a `{ category, protocol?, notes }` object, produced by Llama 3.3 with JSON-mode prompting, batched 10 at a time.

**Pre-conditions:** M3 green.

**Steps:**
1. Create `src/ingest/classifyTxs.ts`: takes a batch of 10 decoded txs, builds a prompt that asks Llama 3.3 to emit a JSON array of classifications (one per tx, in order).
2. Add a defensive JSON parser: strip code fences, retry once on parse failure with an explicit "return only raw JSON" instruction.
3. In `WalletAgent.refresh()`, after decode, loop batches of 10 through `classifyTxs` and persist results onto each row.
4. Application prompt goes in `PROMPTS.md` **verbatim** (this is a graded artifact).
5. If accuracy is poor, add the fallback: `@cf/meta/llama-3.1-8b-instruct` for classification only. (Decision §0a.)
6. Extend the integration smoke test to assert at least 80% of ingested rows have a non-null classification.
7. Run `/shadow-check` → green.
8. Append M4 block to `PROMPTS.md` (meta-prompts + application prompt for classification).
9. `git add -A && git commit -m "M4: classify ingested txs via Llama 3.3 (batched JSON-mode)"`.

**Verification:**
- `/shadow-check` green.
- Integration test: classified-rows ratio ≥ 0.8 for the test address.

---

## M5 — Dossier summarization

**Goal:** After classify, a follow-up Llama 3.3 call produces `{ strategyTags, narrative, riskFlags, topProtocols, topCounterparties }` and writes it into `state.dossier`. Dossier version bumps.

**Pre-conditions:** M4 green.

**Steps:**
1. Create `src/ingest/summarizeDossier.ts`: aggregates classifications + counterparty counts, builds a prompt that returns the `Dossier` shape (PRD §11) minus `generatedAt`/`version`/`address`.
2. Wire into `WalletAgent.refresh()` after classify; bump `state.dossier.version`, set `generatedAt = Date.now()`, persist.
3. Log the summarization application prompt verbatim in `PROMPTS.md`.
4. Integration smoke test: assert `strategyTags.length >= 1` and `narrative.length > 50` for the test address.
5. `/shadow-check` → green.
6. Append M5 block to `PROMPTS.md`.
7. `git add -A && git commit -m "M5: dossier summarization via Llama 3.3 writing into WalletAgent state"`.

**Verification:** `/shadow-check` green; integration smoke test passes.

---

## M6 — Durable ingestion via `IngestWorkflow`

**Goal:** Extract M3–M5 from `WalletAgent.refresh()` into a Cloudflare Workflow. `WalletAgent` triggers the workflow on `initialize()` and `refresh()`. A mid-run kill (SIGINT in dev) resumes from the last successful `step.do`.

**Pre-conditions:** M5 green.

**Steps:**
1. Via `cloudflare-docs` MCP: confirm the current class name and wrangler binding shape for Cloudflare Workflows (`WorkflowEntrypoint` vs `AgentWorkflow`). Pin the answer in CLAUDE.md before writing code.
2. Create `src/ingest/workflow.ts`: `class IngestWorkflow extends WorkflowEntrypoint<Env, { address: string }>` with steps `fetch-txs`, `decode`, `classify`, `summarize`, `persist`, mirroring PRD §6.3.
3. Add `INGEST` workflow binding to `wrangler.jsonc`.
4. `WalletAgent.refresh()` now calls `this.env.INGEST.create({ params: { address: this.state.address } })` instead of running the steps inline.
5. `IngestWorkflow.persist` step calls back into the `WalletAgent` via DO RPC (`env.WALLET.get(idFromName(address)).applyDossier(dossier, txs)`). Add an `applyDossier(dossier, txs)` method to `WalletAgent`.
6. Verify durability: run an integration test that starts a workflow, kills `wrangler dev` between `classify` and `summarize`, restarts, and asserts `persist` still runs. Document the test procedure in a comment.
7. Append M6 block to `PROMPTS.md`.
8. `/shadow-check` → green. `git add -A && git commit -m "M6: extract ingestion into IngestWorkflow (resumable across reboots)"`.

**Verification:** `/shadow-check` green; durability test documented.

---

## M7 — Scheduled refresh

**Goal:** Each `WalletAgent` schedules `scheduledRefresh` every 10 minutes. Confirmed in dev logs.

**Pre-conditions:** M6 green.

**Steps:**
1. In `WalletAgent`, register `this.schedule("*/10 * * * *", "scheduledRefresh")` from `initialize()` (or `onStart`, per docs — confirm via MCP). `scheduledRefresh()` calls `this.refresh()` for incremental blocks since `state.lastSyncedBlock`.
2. Verify in local dev: log each fire; let it run for >10 min and confirm two fires.
3. Add a guard that skips the fire if `Date.now() - state.updatedAt < 9 * 60 * 1000` to prevent double-runs.
4. `/shadow-check` → green.
5. Append M7 block to `PROMPTS.md`.
6. `git add -A && git commit -m "M7: schedule 10-min incremental refresh per WalletAgent"`.

**Verification:** `/shadow-check` green; local dev log shows `scheduledRefresh` firing on cadence.

---

## M8 — `ResearcherAgent` + LLM tools

**Goal:** Rename/refactor `ChatAgent` → `ResearcherAgent`. Expose three LLM tools (`queryWallet`, `compareWallets`, `listWatched`) that route to `WalletAgent` DOs. Persist watchlist in synced state. System prompt instructs Llama to always call `queryWallet` before making wallet-specific claims.

**Pre-conditions:** M7 green.

**Steps:**
1. Rename class `ChatAgent` → `ResearcherAgent` in `src/server.ts`. Update wrangler DO binding name to `RESEARCHER` (class `ResearcherAgent`). Add a new migration tag (do NOT mutate v1) for the class-rename path — confirm migration syntax via `cloudflare-docs` MCP.
2. Add synced state shape `ResearcherState` (PRD §11) and `@callable()` methods: `addToWatchlist`, `removeFromWatchlist`, `getWatchlist`, `getDossier(address)`.
3. Define three `tool`s (from the `ai` package) in `onChatMessage`:
   - `queryWallet(address, question)` → `env.WALLET.get(idFromName(address.toLowerCase())).getDossier()` + recent activity, return structured context.
   - `compareWallets(a, b)` → fetch both dossiers, return a side-by-side summary.
   - `listWatched()` → return `state.watchlist` with one-line headlines.
4. Set system prompt: final text logged verbatim in `PROMPTS.md`.
5. Update kebab-case routing URL in notes: `/agents/researcher-agent/default`.
6. Integration test: addToWatchlist → chat "summarize this wallet" → assert the stream contains a `queryWallet` tool call event and final narrative.
7. Append M8 block to `PROMPTS.md` with final system prompt + tool description strings.
8. `/shadow-check` → green. `git add -A && git commit -m "M8: ResearcherAgent with queryWallet/compareWallets/listWatched LLM tools"`.

**Verification:** `/shadow-check` green; integration test passes.

---

## M9 — Frontend (React + Vite + Tailwind, served by the Worker)

**Goal:** Three-panel React UI (Watchlist / Dossier / Chat) served by the same Worker via `assets` binding. Uses `useAgent` for watchlist+dossier state sync and `useAgentChat` for streamed chat. Tool calls render inline as collapsible cards.

**Pre-conditions:** M8 green.

**Steps:**
1. Decide frontend build tooling (§0a): default to `@cloudflare/vite-plugin`. Confirm via `cloudflare-docs` MCP that it's compatible with DO + Workers AI bindings and single-Worker + assets deploy. Fall back to plain Vite + manual `assets.directory` if not.
2. Install: `react react-dom`, `@vitejs/plugin-react`, `@cloudflare/vite-plugin` (or plain `vite`), `tailwindcss`, `postcss`, `autoprefixer`. Init Tailwind config.
3. Create `index.html`, `src/client/main.tsx`, `src/client/App.tsx`, and three panels under `src/client/components/`:
   - `Watchlist.tsx` — input + list, uses `useAgent` to read `state.watchlist`.
   - `Dossier.tsx` — tags, narrative, risk flags, recent activity list.
   - `Chat.tsx` — `useAgentChat`, renders streamed text + inline tool-call cards.
4. Wire `assets` binding in `wrangler.jsonc`: `directory: "./dist"`, `binding: "ASSETS"`, `not_found_handling: "single-page-application"`, `run_worker_first: ["/agents/*"]` (so Worker handles agent WebSockets, SPA handles everything else).
5. `npm run dev` (or `vite dev`) locally and manually walk Flow A (first look) and Flow B (follow-up question) from PRD §4.
6. Capture a screenshot/gif for M11's README.
7. `/shadow-check` → green.
8. Append M9 block to `PROMPTS.md`.
9. `git add -A && git commit -m "M9: React three-panel UI (Watchlist / Dossier / Chat) served by Worker+assets"`.

**Verification:** `/shadow-check` green; manual flows A and B pass in browser.

---

## M10 — Polish + first real deploy

**Goal:** Favicon, loading states, error toasts. First real `wrangler deploy`. Scheduled refresh verified on production.

**Pre-conditions:** M9 green.

**Steps:**
1. Polish pass: loading spinners on Dossier/Chat panels while refresh/streaming runs; error toast on tool-call failure; favicon.
2. Any remaining "Pages" language in CLAUDE.md or PRD gets rewritten to "single Worker with assets binding". (PRD §7 table, PRD §8 Tech choices.)
3. Via `cloudflare-api` MCP:
   - Create production KV namespace for `ABI_CACHE` (if different from dev).
   - Set prod secrets `ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY`.
4. `npx wrangler deploy` (the first real deploy). Capture the deploy URL.
5. Add a wallet via the deployed UI; confirm dossier renders. Wait >10 min; confirm scheduled refresh fired (check via `cloudflare-api` MCP logs).
6. `/shadow-check` → green.
7. Append M10 block to `PROMPTS.md`.
8. `git add -A && git commit -m "M10: polish + first production deploy; verified scheduled refresh live"`.

**Verification:** `/shadow-check` green; live URL loads and streams; scheduled refresh visible in production logs.

---

## M11 — README + PROMPTS.md finalization

**Goal:** Repo is submission-ready. README has everything §10 of the PRD requires. PROMPTS.md is current and verbatim for every shipped prompt.

**Pre-conditions:** M10 deployed.

**Steps:**
1. Write full `README.md` per PRD §10 ordering: (1) one-line description, (2) screenshot/gif (from M9), (3) live deploy link (from M10), (4) §7 requirement-mapping table, (5) architecture diagram (ASCII from PRD §5 is fine), (6) local-dev instructions (`npm i`, set `.dev.vars`, `npm run dev`), (7) deploy instructions (`npm run deploy`), (8) known limitations (Ethereum mainnet only, no auth, 200-tx cap, global singleton ResearcherAgent).
2. All README language says "single Worker with assets binding", never "Cloudflare Pages".
3. Final scrub of `PROMPTS.md`: every shipped application prompt (chat system prompt, classification template, summarization template, tool description strings) is logged verbatim.
4. Confirm `cf_ai_` repo prefix in `package.json`, `wrangler.jsonc`, directory name.
5. Confirm no secrets committed: `git log -p -- wrangler.jsonc .dev.vars* 2>/dev/null`.
6. `/shadow-check` → green.
7. `git add -A && git commit -m "M11: README + PROMPTS final for submission"`.
8. Final push to GitHub (create the repo via `github` MCP if available; otherwise ask the user to run `git remote add` + `git push -u origin main`). Repo name: `cf_ai_shadow`.

**Verification:** `README.md` passes the PRD §14 checklist; `/shadow-check` green; remote repo public (or shareable) under `cf_ai_shadow`.

---

## Commit-message convention

Every milestone-boundary commit is prefixed `M{n}:` and describes the outcome, not the actions. Intermediate WIP commits during a milestone are fine but are not milestone markers.

## PROMPTS.md protocol (reminder)

At every milestone commit: append `## M{n} — {name}` with `### Meta-prompts` and `### Application prompts` subheadings. Meta-prompts are logged **strict verbatim** — copy the user's message character-for-character, including typos and casing. If a milestone produced no prompts of a kind, write "None this milestone" under that subheading. Do not omit the subheading.

## Deviation policy

If during execution a step as written here turns out to be wrong (e.g. doc changed, a package API differs, a binding shape is off), **stop, amend this plan.md with the corrected step and a short `> deviation:` note, commit the plan change, then resume**. The commit history should always show the plan update preceding the code change it enables.
