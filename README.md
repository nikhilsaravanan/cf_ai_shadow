# Shadow — `cf_ai_shadow`

> An AI research agent that tails DeFi wallets on Ethereum mainnet, builds a persistent dossier per wallet via the Cloudflare Agents SDK, and lets you chat with it over WebSocket.

Submission for the Cloudflare 2026 internship assignment (AI-powered application).

---

## What it does

Paste an Ethereum address. Shadow fans out into a durable Cloudflare Workflow that pulls the last 200 transactions, decodes them against on-chain ABIs, classifies each one with an LLM (`swap` / `lp` / `lending` / `transfer` / `bridge` / `governance` / …), and synthesizes a dossier with strategy tags, a narrative summary, top protocols, top counterparties, and risk flags. The dossier is stored in a per-wallet Durable Object and refreshed every 10 minutes by a scheduled task, so coming back later shows fresh state without re-paying the cold-start cost.

A single chat agent (`ResearcherAgent`, an `AIChatAgent`) sits in front of the per-wallet DOs. You can ask it things like *"summarize the vitalik wallet"* or *"list my watchlist"* — the model picks the right tool, the tool fans out via DO-to-DO RPC to the matching `WalletAgent`, and the answer streams back over WebSocket grounded in the live dossier. (No hallucinated tx hashes — the system prompt forces tool calls before any wallet-specific claim.)

## Screenshot

`<TODO: gif/screenshot lands at M10 polish pass>`

## Live deploy

`<TODO: production URL lands at M10 first-real-deploy>`

## Assignment requirement → Shadow component

The assignment asks for four things. Shadow maps them to Cloudflare primitives like this:

| Assignment requirement | Shadow implementation |
|---|---|
| **LLM** | **Chat:** Gemini 2.5 Flash via `@ai-sdk/google` (the assignment explicitly allows "an external LLM of your choice"). **Ingestion:** Workers AI `@cf/meta/llama-3.1-8b-instruct` for transaction classification + dossier summarization, called via REST. The split keeps the bounded Workers AI free-tier quota dedicated to the ingestion side and lets the high-volume chat side run unbounded. |
| **Workflow / coordination** | `ResearcherAgent` (extends `AIChatAgent`) and `WalletAgent` (extends `Agent`) are Durable Objects via the Cloudflare **Agents SDK**. `IngestWorkflow` is a Cloudflare **Workflow** (`WorkflowEntrypoint`) — durable, resumable across reboots, retries each step on failure. `WalletAgent` registers a 10-minute `scheduledRefresh` cron via `this.schedule(...)`. |
| **User input via chat or voice** | Three-panel React 19 + Vite + Tailwind UI (Watchlist / Dossier / Chat) served by the **same Worker** via an `assets` binding (no separate Pages project). Chat is over **WebSocket** through `useAgentChat()` from `@cloudflare/ai-chat/react`; synced state (watchlist + dossier) flows through `useAgent()` from `agents/react`. |
| **Memory / state** | Per-wallet **SQLite** inside each `WalletAgent` DO (`transactions`, `counterparties` tables). Synced KV state for the `Dossier` and the `ResearcherAgent`'s `watchlist`. `AIChatAgent` auto-persists chat history. **KV namespace** `ABI_CACHE` caches Etherscan ABI lookups with a 7-day TTL. |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              React SPA (served by the Worker's assets binding)    │
│             useAgent() · useAgentChat() · WebSocket               │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │   ResearcherAgent (DO)        │   AIChatAgent
                 │   - watchlist (synced state)  │   singleton  ("default")
                 │   - chat history (SQLite)     │
                 │   - tools: queryWallet,       │
                 │     compareWallets,           │
                 │     listWatched               │
                 └──────────────┬───────────────┘
                                │  DO-to-DO RPC
                                ▼
                 ┌──────────────────────────────┐
                 │   WalletAgent (DO)            │   Agent
                 │   one per address (lowercased)│
                 │   - dossier (synced state)    │
                 │   - tx + counterparty SQLite  │
                 │   - this.schedule("*/10 * *") │
                 └──────────────┬───────────────┘
                                │  triggers
                                ▼
                 ┌──────────────────────────────┐
                 │   IngestWorkflow              │   WorkflowEntrypoint
                 │   step.do("fetch-txs")        │   durable, resumable
                 │   step.do("decode")           │
                 │   step.do("classify")  ◀──── Workers AI · Llama 3.1 8B
                 │   step.do("summarize") ◀──── Workers AI · Llama 3.1 8B
                 │   step.do("persist")          │
                 └──────────────┬───────────────┘
                                │
                  ┌─────────────┴────────────┐
                  ▼                          ▼
           ┌────────────┐           ┌──────────────┐
           │  Alchemy   │           │  Etherscan   │
           │ (transfers │           │ (ABIs, KV-   │
           │  + RPC)    │           │  cached 7d)  │
           └────────────┘           └──────────────┘

         Chat narration ◀── Gemini 2.5 Flash (@ai-sdk/google)
```

Mental model: one `WalletAgent` is one wallet's living dossier. The `ResearcherAgent` is the user's chat counterpart and watchlist. The `IngestWorkflow` is the durable pipeline that fills and refreshes a `WalletAgent`. Frontend talks only to `ResearcherAgent`; all fan-out happens server-side over DO-to-DO RPC.

## Run it locally

You need Node 20+ and four API keys (all free-tier):

| Key | Where to get it |
|---|---|
| `ALCHEMY_API_KEY` | https://dashboard.alchemy.com (free tier is enough) |
| `ETHERSCAN_API_KEY` | https://etherscan.io/apis |
| `WORKERS_AI_API_TOKEN` | Cloudflare dashboard → AI → Workers AI → API tokens |
| `GOOGLE_GENERATIVE_AI_API_KEY` | https://aistudio.google.com/apikey |

Then:

```bash
git clone <this-repo>
cd cf_ai_shadow
npm install

# create .dev.vars at the repo root with the four keys above:
cat > .dev.vars <<'EOF'
ALCHEMY_API_KEY=...
ETHERSCAN_API_KEY=...
WORKERS_AI_API_TOKEN=...
GOOGLE_GENERATIVE_AI_API_KEY=...
EOF

npm run dev
# → open http://localhost:5173
```

In the UI: paste a wallet (e.g. Vitalik's `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`), click **Add wallet**, watch the dossier render. Then ask the chat panel things like *"summarize this wallet"* or *"list my watchlist"*.

First-touch ingestion takes ~15s on a busy wallet (200 txs, ABI lookups, classification batches). Subsequent refreshes are incremental — only new blocks are fetched, and already-classified txs are reused from SQLite.

## Deploy

> First production deploy lands at M10. Once done, the URL above will be live.

```bash
# one-time setup of prod secrets (requires a Cloudflare account)
npx wrangler secret put ALCHEMY_API_KEY
npx wrangler secret put ETHERSCAN_API_KEY
npx wrangler secret put WORKERS_AI_API_TOKEN
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY

# create the prod KV namespace and update wrangler.jsonc with its id
npx wrangler kv namespace create ABI_CACHE

# deploy
npm run deploy
```

## Known limitations (MVP)

- **Ethereum mainnet only.** No L2s, no other chains. `viem` makes adding chains trivial; deferred to keep ingestion bounded.
- **No auth.** The `ResearcherAgent` is a global singleton named `"default"`. Anyone with the URL shares state. Proper fix is Cloudflare Access + use the authenticated email as the DO name.
- **200-tx cap per wallet.** Free-tier Alchemy + Llama latency. Plenty for a first-look dossier; insufficient for full historical analysis on whales.
- **Read-only.** Shadow never signs transactions, never touches private keys, and explicitly never calls `writeContract` / `sendTransaction`.
- **Free-tier scheduling caveat.** `scheduledRefresh` runs every 10 min per watched wallet. With ~3 wallets this comfortably stays inside Workers AI free-tier (10k neurons/day) thanks to the M9.2 incremental-ingest fix (cached classifications + skip-on-no-op). With 50+ wallets you'd want to upgrade or stretch the cron.

## Repo layout

```
cf_ai_shadow/
├── src/
│   ├── server.ts            # ResearcherAgent + Worker entrypoint
│   ├── walletAgent.ts       # WalletAgent DO + SQLite migrations
│   ├── ingest/
│   │   ├── workflow.ts      # IngestWorkflow (WorkflowEntrypoint)
│   │   ├── fetchTxs.ts      # Alchemy getAssetTransfers
│   │   ├── decodeTxs.ts     # viem + Etherscan ABI cache
│   │   ├── classifyTxs.ts   # Workers AI Llama 3.1 8B (batched JSON-mode)
│   │   └── summarizeDossier.ts  # Workers AI Llama 3.1 8B (dossier synth)
│   └── client/              # React 19 + Vite + Tailwind SPA
│       ├── App.tsx          # three-panel shell + ambient blobs
│       └── components/      # Watchlist, Dossier, RightRail, Chat, Sparkline
├── PRD.md                   # product spec (assignment context)
├── plan.md                  # ordered build script (M0 → M11)
├── PROMPTS.md               # every AI prompt used to build / run this app
├── CLAUDE.md                # build rails for the AI coding assistant
└── wrangler.jsonc           # Worker config (DO bindings, Workflows, KV, assets)
```

## Reviewer cheat sheet

If you only have 60 seconds:
1. Read the **mapping table** above — it's the assignment-criteria checklist.
2. Open `src/server.ts` for the chat agent + tool definitions, `src/walletAgent.ts` for the DO/SQLite shape, `src/ingest/workflow.ts` for the durable pipeline.
3. Open `PROMPTS.md` to see every meta-prompt and application prompt used during build (assignment requirement: log every prompt).
4. Open `plan.md` to see the milestone-by-milestone build history and deviations.

If you have more time, run it locally with the four free-tier keys and paste Vitalik's address — within ~15 seconds you'll see a dossier render with strategy tags + narrative + recent activity, and the chat panel will answer follow-up questions grounded in the live data.
