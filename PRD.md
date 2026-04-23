# Shadow — PRD

> **Repo name:** `cf_ai_shadow`
> **One-liner:** A Cloudflare-native AI research agent that tails DeFi wallets, builds a living "dossier" per wallet, and lets you chat with it over WebSocket.
> **Owner:** Nikhil (ns36686@my.utexas.edu)
> **Target:** Cloudflare 2026 internship assignment — AI-powered application
> **Stack:** Workers AI (Llama 3.3) · Cloudflare Agents SDK · Durable Objects · Workflows · Pages (React) · WebSockets

---

## 1. Why this exists

DeFi researchers, DAO contributors, and protocol devs constantly do the same manual dance: open Etherscan, paste a wallet, click through thousands of transactions, and try to reconstruct what the wallet is actually *doing* — is this a fund leveraging up, an airdrop farmer, an MEV bot, a TWAP sell? Tools like Arkham and Nansen do this with large teams, closed datasets, and opaque pricing. Shadow is the smallest honest version of that idea: give an AI agent the wallet, let it narrate the wallet's behavior, and let you ask follow-up questions in natural language.

The interesting thing for a Cloudflare reviewer is not the DeFi domain — it's that the problem shape ("one long-lived stateful assistant per entity you're watching, polling on a schedule, streaming results back to a browser") maps almost perfectly onto the Agents SDK primitives. One Durable Object per watched wallet. One `AIChatAgent` for the user's overall research workspace. One `AgentWorkflow` for the durable tx-ingest pipeline. Everything the assignment asks for falls out naturally.

## 2. Goals (what "done" looks like for the MVP)

A reviewer can run the app, paste a wallet address like Vitalik's (`0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`), see Shadow pull the last N transactions, classify them, and render a dossier (strategies, notable counterparties, risk flags, recent activity summary). They can then chat with Shadow — "summarize this wallet's last 30 days," "has it interacted with Aave?", "compare this wallet to 0xabc" — and get streamed Llama 3.3 responses grounded in the on-chain data Shadow just ingested. The wallet can be added to a persistent watchlist that survives refresh/reconnect, and a scheduled refresh runs in the background so the dossier stays current.

## 3. Non-goals (ruthlessly out of scope for MVP)

Shadow is not a trading tool — it never signs or broadcasts transactions. It does not support every chain: Ethereum mainnet only for MVP. It does not do deep MEV analysis, contract disassembly, or governance monitoring. It does not do alerts/email/push — "notable events" surface in the chat feed only. There is no auth for the MVP; any user of the deploy shares state (see §13 for the deferred auth plan). No mobile UI. No price charts.

## 4. Target user & canonical use cases

The user is a builder/researcher — someone comfortable pasting hex addresses, who wants faster forensics than Etherscan but doesn't want to pay for Nansen. Three canonical flows the MVP must nail:

**Flow A — First look.** User pastes a wallet. Shadow ingests the last 200 txs, runs them through Llama 3.3 for classification, and within ~15 seconds shows a dossier with: top protocols touched, strategy tags (e.g. "Aave lender," "Uniswap LP," "CEX user"), notable counterparties, and a one-paragraph narrative summary.

**Flow B — Ask follow-ups.** User asks "has this wallet used any L2 bridges?" in the chat. The `ResearcherAgent` pulls context from the relevant `WalletAgent`'s dossier + recent txs and streams a grounded answer.

**Flow C — Come back later.** User closes the tab. A day later they reopen it — watchlist is still there, each wallet's dossier has been auto-refreshed on a schedule, and any new activity is summarized at the top of the chat.

## 5. Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Cloudflare Pages (React + Vite)                │
│        useAgentChat() ── WebSocket ──▶                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │   ResearcherAgent (DO)       │      extends AIChatAgent
                 │   - watchlist state           │      singleton per user (MVP: one global)
                 │   - chat history (SQLite)     │
                 │   - tools: query/compare      │
                 └──────────────┬───────────────┘
                                │ DO-to-DO RPC
                                ▼
                 ┌──────────────────────────────┐
                 │   WalletAgent (DO)           │      extends Agent
                 │   one per wallet address      │      DO name = address
                 │   - dossier KV state          │
                 │   - tx table (SQLite)         │
                 │   - this.schedule("*/10 * *") │
                 └──────────────┬───────────────┘
                                │ triggers
                                ▼
                 ┌──────────────────────────────┐
                 │   IngestWorkflow (AgentWf)   │      extends WorkflowEntrypoint
                 │   step.do("fetch-txs")        │      durable, retried
                 │   step.do("decode")           │
                 │   step.do("classify")   ◀─── env.AI.run(@cf/meta/llama-3.3-...)
                 │   step.do("summarize")  ◀─── env.AI.run(...)
                 │   step.do("persist")          │
                 └──────────────┬───────────────┘
                                │
                     ┌──────────┴──────────┐
                     ▼                      ▼
              ┌────────────┐         ┌───────────┐
              │ Alchemy /  │         │ Etherscan │
              │ public RPC │         │ (ABI/tags)│
              └────────────┘         └───────────┘
```

The mental model: the **ResearcherAgent** is the user's persistent workspace and chat counterpart. The **WalletAgent** is one long-lived dossier per watched wallet — it owns the data for that wallet and exposes read methods. The **IngestWorkflow** is the durable pipeline that populates and refreshes a WalletAgent. The React UI talks only to the ResearcherAgent over WebSocket; all fan-out happens server-side via DO-to-DO RPC.

## 6. Component specs

### 6.1 `ResearcherAgent` (extends `AIChatAgent`)

One instance for the MVP (hardcoded name `"default"`; in v2 becomes one per auth'd user). Owns:

- **State (synced KV):** `{ watchlist: string[], lastSeenDossierVersions: Record<address, number> }`
- **SQLite:** chat history (auto-managed by `AIChatAgent`), plus a small `annotations` table for user-added notes on wallets
- **`@callable()` RPCs:** `addToWatchlist(address)`, `removeFromWatchlist(address)`, `getWatchlist()`, `getDossier(address)`
- **Chat tools exposed to the LLM:**
  - `queryWallet(address: string, question: string)` — routes to the WalletAgent for that address, pulls its dossier and recent activity, returns a structured context block
  - `compareWallets(a: string, b: string)` — pulls both dossiers, returns a side-by-side diff for the LLM to narrate
  - `listWatched()` — returns current watchlist with one-line summaries
- **System prompt** instructs Llama 3.3 to *always* call `queryWallet` before making claims about a specific wallet's behavior, and to cite tx hashes when narrating specific events.

### 6.2 `WalletAgent` (extends `Agent`)

One instance per wallet address. DO name = lowercased address. Owns:

- **State (synced KV):** `{ address, chain: "ethereum", lastSyncedBlock: number, dossier: Dossier, txCount: number, updatedAt: number }`
- **SQLite tables:**
  - `transactions (hash PK, block_number, timestamp, from, to, value_wei, method_id, decoded_input JSON, classification JSON)`
  - `counterparties (address PK, label, interaction_count, first_seen, last_seen)`
- **`@callable()` RPCs:** `initialize(address)`, `refresh()` (manual trigger), `getDossier()`, `getRecentActivity(limit)`, `getTxByHash(hash)`
- **Scheduled task:** `this.schedule("*/10 * * * *", "scheduledRefresh")` — every 10 min, kick off an incremental IngestWorkflow for any new blocks since `lastSyncedBlock`.
- **Hibernation:** uses hibernatable WebSockets; idle wallets cost effectively nothing. Worth calling out in README.

### 6.3 `IngestWorkflow` (extends `WorkflowEntrypoint`)

Triggered by a WalletAgent on first-touch and on schedule. Steps:

1. **`fetch-txs`** — call Alchemy `alchemy_getAssetTransfers` (or equivalent eth_getLogs calls) for the address range. Cap at 200 txs for MVP. Retry on 429.
2. **`decode-txs`** — for each tx, look up the `to` contract's ABI via Etherscan (cached in KV), decode the call. Unknowns are tagged `unknown_contract`.
3. **`classify-txs`** — batch txs in groups of 10, call Llama 3.3 with a structured-output prompt that returns `{ category: "swap"|"lp"|"lending"|"transfer"|"bridge"|"governance"|"airdrop"|"other", protocol?: string, notes: string }` per tx.
4. **`summarize-dossier`** — call Llama 3.3 with the aggregated classifications and top counterparties to produce: (a) 3–7 strategy tags, (b) a 2–4 sentence narrative summary, (c) a risk-flag list (e.g. "interacts with known phishing contract," "high leverage on Aave").
5. **`persist`** — write transactions, classifications, counterparties, and updated dossier back into the WalletAgent (via DO RPC). Bump dossier version.

Because it's an `AgentWorkflow`, a reboot mid-ingest resumes from the last successful step. That durability guarantee is a core selling point of the Cloudflare stack and should be mentioned in the README.

### 6.4 React frontend (Cloudflare Pages)

Single-page app, Vite + React 19 + Tailwind. Three panels:

- **Left: Watchlist.** Input field to add a wallet. List of watched wallets, each row showing label (if any), short address, last-refreshed timestamp, and a one-line headline from the dossier. Click a row to focus it.
- **Center: Dossier.** Tags, narrative summary, risk flags, recent activity timeline (last 20 classified txs with human-readable lines like "Swapped 5 ETH for USDC on Uniswap V3 — 4h ago"). Empty state before a wallet is selected.
- **Right: Chat.** `useAgentChat()` from `agents/react`. Streamed responses. Tool calls render as collapsible "Shadow queried 0xabc..." cards inline.

Uses `useAgent()` for watchlist/dossier state sync (auto-syncs from ResearcherAgent state) and `useAgentChat()` for the chat stream.

### 6.5 External data sources

- **Alchemy** (free tier) for RPC + `getAssetTransfers`. Fallback to public Cloudflare-hosted eth-rpc if key missing. API key via `wrangler secret`.
- **Etherscan** (free tier) for contract ABIs and address labels. Cached aggressively in Workers KV (`ABI_CACHE` namespace) with 7-day TTL.
- **DeFiLlama** (no key) for protocol name resolution from contract address.
- **CoinGecko** (no key, free tier) for token prices — only used in v2; MVP shows values in wei/ETH.

## 7. Required-components mapping (for the reviewer)

This is the table that goes in the README so a reviewer can check off the assignment criteria in 30 seconds:

| Assignment requirement | Shadow implementation |
|---|---|
| **LLM** | Workers AI, model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, called via `env.AI.run(...)` for both tx classification and chat |
| **Workflow / coordination** | `ResearcherAgent` and `WalletAgent` are Durable Objects (Agents SDK). `IngestWorkflow` is a Cloudflare Workflow (via `AgentWorkflow`) for durable, resumable tx ingestion |
| **User input via chat or voice** | React frontend on Cloudflare Pages, chat over WebSocket via `useAgentChat()` |
| **Memory / state** | Per-wallet SQLite inside each `WalletAgent` DO (txs, counterparties) + synced KV state (dossier) + `AIChatAgent`'s persisted message history on the `ResearcherAgent` |

## 8. Tech choices (pin these to avoid drift during build)

- **Runtime:** Workers + Durable Objects, `compatibility_date = "2025-04-01"` or later, `nodejs_compat` on.
- **Agents SDK:** `npm i agents` (latest). Extend `AIChatAgent` and `Agent`. Use TC39 decorators — set `"target": "ES2022"` or `"ES2021"` in `tsconfig.json`, do NOT enable `experimentalDecorators`.
- **LLM model ID:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Use structured-output / JSON mode for classification. Tool-calling for chat.
- **RPC client:** `viem` for Ethereum calls (lighter than ethers, Workers-friendly).
- **Frontend:** React 19, Vite, Tailwind. Deployed on Pages. Uses `agents/react` hooks.
- **Starter:** Begin from `npm create cloudflare@latest -- --template=cloudflare/agents-starter` and strip what we don't use.
- **Wrangler bindings:**
  - `AI` (Workers AI)
  - `RESEARCHER` (DO binding → ResearcherAgent)
  - `WALLET` (DO binding → WalletAgent)
  - `INGEST` (Workflow binding)
  - `ABI_CACHE` (KV)
  - Secrets: `ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY`

## 9. Build plan (sequenced for Claude Code)

Each milestone ends with something runnable. Don't move to the next until the current one works end-to-end.

**M1 — Scaffold.** Generate project from `agents-starter`. Rename to `cf_ai_shadow`. Strip demo tools. Confirm `npm run dev` shows a blank chat that can talk to Llama 3.3. Commit.

**M2 — `WalletAgent` skeleton.** Create the class with state schema, SQLite migrations for `transactions` and `counterparties`, and stub `@callable` methods returning hardcoded data. Write a one-shot script that creates a WalletAgent via `idFromName(address)` and calls `getDossier()`. Commit.

**M3 — Tx ingestion (no LLM yet).** Wire viem + Alchemy. Implement `fetch-txs` and `decode-txs` as a plain async function inside WalletAgent (not a Workflow yet). Store txs in SQLite. Verify with a known active wallet. Commit.

**M4 — Classification via Llama 3.3.** Add the `classify-txs` step. Use JSON-mode prompting. Batch 10 at a time. Persist classification into the tx row. Commit.

**M5 — Dossier summarization.** Aggregate classifications + counterparties, call Llama 3.3 for strategy tags + narrative + risk flags. Persist into `state.dossier`. Commit.

**M6 — Durable ingestion via Workflow.** Extract M3–M5 into an `AgentWorkflow` (`IngestWorkflow`). WalletAgent triggers it on `initialize()` and `refresh()`. Verify mid-run kill still resumes. Commit.

**M7 — Scheduling.** Add `this.schedule("*/10 * * * *", "scheduledRefresh")` to WalletAgent. Confirm in logs it fires. Commit.

**M8 — `ResearcherAgent` + tools.** Create it as `AIChatAgent`. Implement `queryWallet`, `compareWallets`, `listWatched` as LLM tools that call WalletAgent DOs. Hardcode the singleton name `"default"`. Commit.

**M9 — Frontend.** Build the three-panel React UI. `useAgent` for watchlist/dossier state, `useAgentChat` for chat stream. Render tool calls inline. Commit.

**M10 — Polish.** Favicon, loading states, error toasts. Deploy to Pages + Workers. Verify scheduled refresh fires on production. Commit.

**M11 — README + PROMPTS.** Write `README.md` (see §10) and `PROMPTS.md` (log every prompt used to generate substantive code). Add the deploy link. Final commit.

## 10. Repo conventions

- **Repo name:** `cf_ai_shadow` (the `cf_ai_` prefix is load-bearing — the assignment requires it).
- **`README.md`** must contain, in order:
  1. One-line description.
  2. Screenshot/gif of the app.
  3. Live deploy link.
  4. The mapping table from §7.
  5. Architecture diagram (can be the ASCII in §5 or a real image).
  6. Local-dev instructions: `npm i`, `wrangler secret put ALCHEMY_API_KEY`, `npm run dev`, open `localhost:5173`, paste a wallet, done.
  7. Deploy instructions: `npm run deploy`.
  8. Known limitations (mainnet only, no auth, 200-tx cap, etc.).
- **`PROMPTS.md`** must contain every meaningful AI prompt used during development. Organize by milestone. For each prompt, note what was generated and any manual edits made afterward. The assignment explicitly requires this.
- **Originality:** no copy-paste from other Agents-SDK starter submissions. The starter template itself is fine to begin from (it's Cloudflare's own scaffold).

## 11. Data shapes (for Claude Code to avoid guessing)

```ts
type Classification = {
  category: "swap" | "lp" | "lending" | "transfer" | "bridge" | "governance" | "airdrop" | "mint" | "other";
  protocol?: string;          // e.g. "Uniswap V3", "Aave V3"
  notes: string;              // 1-sentence human-readable description
};

type Dossier = {
  version: number;             // bumped on every successful IngestWorkflow run
  address: string;
  strategyTags: string[];      // e.g. ["Aave lender", "Uniswap LP", "airdrop farmer"]
  narrative: string;           // 2-4 sentence summary
  riskFlags: { severity: "info" | "warn" | "high"; message: string }[];
  topProtocols: { protocol: string; interactionCount: number }[];
  topCounterparties: { address: string; label?: string; count: number }[];
  generatedAt: number;         // epoch ms
};

type ResearcherState = {
  watchlist: string[];                              // lowercased addresses
  lastSeenDossierVersions: Record<string, number>;  // for "new activity since last seen"
};
```

## 12. Stretch goals (only if M1–M11 ship early)

- "Compare wallets" gets a real UI panel, not just a chat tool.
- Support Base + Arbitrum (viem makes this trivial — just add chain configs).
- Real-time activity notification when scheduledRefresh finds a new high-value tx (render a "🔔 New activity" pill in the watchlist row).
- Export dossier as markdown.
- Basic auth via Cloudflare Access so the deploy is per-user.

## 13. Open questions to resolve during build

- **Auth.** MVP ships with no auth and a global singleton `ResearcherAgent`. Anyone with the URL shares state. Acceptable for a reviewer demo; call it out in the README. Proper fix: Cloudflare Access + use the authenticated email as the ResearcherAgent DO name.
- **Rate limits.** Alchemy free tier is 300 CU/s. With a 200-tx cap and 10-min refresh, we're fine for a handful of wallets. If a reviewer adds 50 wallets it'll throttle — accept it for MVP.
- **Llama 3.3 structured output reliability.** Llama does not have first-class JSON mode like OpenAI. Plan: prompt engineer + a defensive parser that retries once on parse failure. If this gets flaky, fall back to `@cf/meta/llama-3.1-8b-instruct` for classification (faster, sometimes more reliable on narrow tasks) and keep 3.3 for the chat/narrative.
- **PII / compliance.** Wallet addresses are public. No PII concerns. No need for logging restrictions.

## 14. Success criteria (how we know this is done)

A reviewer cloning the repo can: (a) run `npm i && npm run dev` and, with just an Alchemy key, paste `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` and see a dossier render within 20 seconds; (b) chat with it and get a streamed, grounded answer; (c) close the tab, come back the next day, and find the dossier has auto-updated; (d) read `README.md` and immediately see which Cloudflare primitive maps to each assignment requirement; (e) read `PROMPTS.md` and see the AI prompts actually used to build the thing. If all five are true, we're done.
