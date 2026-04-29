# Shadow — `cf_ai_shadow`

AI research agent that tails DeFi wallets on Ethereum mainnet, builds a persistent dossier per wallet via the Cloudflare Agents SDK, and lets users chat with it over WebSocket.

Full spec lives in `PRD.md`; ordered build steps live in `plan.md`. This file is the subset of rails Claude will regret forgetting. Read the PRD for feature scope; read `plan.md` for the execution script; read this file for the rules.

## Working directory

Repo root is `cf_ai_shadow/`. All graded artifacts (`PRD.md`, `CLAUDE.md`, `PROMPTS.md`, `plan.md`, `README.md`) and the Worker source live inside it. The `/shadow-check` slash command is wired at `.claude/commands/shadow-check.md`. All `npm`, `wrangler`, and `git` commands run from `cf_ai_shadow/`.

## Starter state

The installed scaffold is the bare "Hello World" Workers starter (`npm create cloudflare@latest` default), **not** `cloudflare/agents-starter`. M1's first job is to add Agents SDK + React deps by following [Build a chat agent](https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/).

## Stack — pin these, do not drift

- **Chat LLM (external):** Gemini 2.5 Flash via `@ai-sdk/google` (`createGoogleGenerativeAI`). The assignment instructions allow either Llama 3.3 on Workers AI or "an external LLM of your choice" — chat is split off external (per M9.7) so the Workers AI free-tier 10k-neuron daily quota is reserved for ingestion. Tool calling uses the AI SDK's standard `tool({ inputSchema: zod, execute })` shape with `streamText({ tools, stopWhen: stepCountIs(5) })`.
- **Ingestion LLM:** Workers AI, model ID `@cf/meta/llama-3.1-8b-instruct` (used in `classifyTxs.ts` and `summarizeDossier.ts`). Called via direct `fetch()` to `/ai/run/<model>` with `Authorization: Bearer ${WORKERS_AI_API_TOKEN}` (the M4 deviation — miniflare's AI binding errors out, so REST instead). JSON-mode prompting for classification.
- **Agents SDK packages:**
  - `agents` — `Agent`, `routeAgentRequest`; `useAgent` from `agents/react`.
  - `@cloudflare/ai-chat` — `AIChatAgent`; `useAgentChat` from `@cloudflare/ai-chat/react`. **Not** from `agents/react` — that's stale.
  - `ai` — `streamText`, `convertToModelMessages`, `tool`, `stepCountIs`, `createUIMessageStream`, `createUIMessageStreamResponse`, `pruneMessages`.
  - `@ai-sdk/google` — `createGoogleGenerativeAI` (chat path only).
  - `workers-ai-provider` — installed for fallback / future use; not currently in the chat path.
  - `zod` — tool input schemas.
  - `ResearcherAgent extends AIChatAgent`, `WalletAgent extends Agent`. `IngestWorkflow` extends Cloudflare Workflows' base class — confirm `WorkflowEntrypoint` (from `cloudflare:workers`) vs any Agents-SDK shorthand via the `cloudflare-docs` MCP at M6 before writing code. PRD's "AgentWorkflow" term is shorthand for the same concept.
- **Frontend:** React 19 + Vite + Tailwind, served by the **same Worker via an `assets` binding** (not a separate Cloudflare Pages project). `use_agent` for synced state, `useAgentChat` for streamed chat.
- **Chain client:** `viem`, not ethers. Ethereum mainnet only.
- **Data sources:** Alchemy (`alchemy_getAssetTransfers` + RPC) and Etherscan (ABI lookup, cached in KV with 7-day TTL).

## Tools at your disposal

Beyond the default Claude Code toolbox (Read, Edit, Write, Bash, Grep, Glob, TodoWrite), you have MCP servers wired up. Prefer the purpose-built tool for each kind of work — they're faster, more accurate, and first-party.

- **Cloudflare API MCP** (`cloudflare-api`, endpoint `https://mcp.cloudflare.com/mcp`). Use for any action on the user's Cloudflare account: listing/creating KV namespaces, setting secrets, deploying Workers, managing DO bindings, reading Worker logs, inspecting deployments. Prefer this over asking the user to run `wrangler` by hand — if the MCP can do it, do it and report back.
- **Cloudflare Docs MCP** (`cloudflare-docs`, endpoint `https://docs.mcp.cloudflare.com/mcp`). Use for every lookup about Workers, Workers AI, Durable Objects, Workflows, Agents SDK, Wrangler, or Pages. **Do not** use web search for Cloudflare topics — the docs MCP is first-party, current, and not blocked by egress rules that web search sometimes hits.
- **Context7 MCP** (optional — use if it appears in `/mcp`). For current docs on third-party libraries: `viem`, `react`, `vitest`, `vite`, `tailwindcss`, `agents` (the SDK). Prefer this over memory for any library API you aren't 100% sure of.
- **GitHub MCP** (optional — use if it appears in `/mcp`). For creating the repo on first push, opening milestone PRs, tracking deferred-work issues.

### Rules about tool use

1. **Never invent an SDK API shape from memory.** Look it up via the Cloudflare Docs MCP (for Cloudflare APIs) or Context7 (for everything else). If neither is installed, ask the user before guessing.
2. **Never use `WebSearch` or `WebFetch` for a Cloudflare topic** when `cloudflare-docs` is available. Half the relevant domains are blocked or stale for web search anyway.
3. **Read-only Cloudflare actions** (listing resources, inspecting configs, reading logs) — just do them via the API MCP and report back. Don't make the user run `wrangler` manually.
4. **Destructive or cost-bearing Cloudflare actions** (creating namespaces, setting secrets, deploying, deleting) — say what you're about to do, do it, and report. Don't narrate a long plan and wait for approval on each step; one line of intent + action is enough.
5. **Never run a real `wrangler deploy`** (without `--dry-run`) until Milestone 10. Before M10, every deploy-ish check goes through `/shadow-check`, which uses `--dry-run`.
6. **Verification is non-negotiable.** Every milestone ends with a passing `/shadow-check`. Do not declare a milestone done without it.

### Slash commands

- `/shadow-check` — canonical pre-commit verification (types + tests + wrangler dry-run). Wired at `.claude/commands/shadow-check.md`. Run it from inside `cf_ai_shadow/` at the end of every milestone. Do not reinvent; do not run individual checks ad-hoc as a substitute. `npm run cf-typegen` is equivalent to `npx wrangler types`; either is fine inside the check.

## Decorator gotcha — will silently break things

The Agents SDK uses TC39 standard decorators. In `tsconfig.json`:

- **Set** `"target"` to **ES2022 or newer** (current `es2024` is fine). Older targets make esbuild's pass treat decorators as native syntax the dev server can't handle.
- **Do NOT set** `"experimentalDecorators": true`. That flag applies the legacy TypeScript transform, which is incompatible — `@callable()` will silently no-op at runtime.

Re-check both rules any time you edit `tsconfig.json`.

## Wrangler bindings — canonical names

Convention: DO / Workflow binding `name` matches its `class_name` so `routeAgentRequest` can kebab-match URLs (`WalletAgent` → `/agents/wallet-agent/…`). Non-agent resources (KV, AI) stay uppercase.

- ~~`AI`~~ — removed in M9.7. Ingestion calls Workers AI via REST (token-auth), chat calls Gemini via `@ai-sdk/google`. Neither needs the binding, and keeping it triggered a remote-preview hop that the inference-only API token couldn't authorize.
- `ChatAgent` — Durable Object binding → `ChatAgent` class. Renamed to `ResearcherAgent` in M8 via a `renamed_classes` migration (class + binding rename together).
- `WalletAgent` — Durable Object binding → `WalletAgent` class
- `IngestWorkflow` — Workflow binding → `IngestWorkflow` class
- `ABI_CACHE` — KV namespace for Etherscan ABI cache

Secrets (via `wrangler secret put` for prod; `.dev.vars` for local):

- `ALCHEMY_API_KEY`
- `ETHERSCAN_API_KEY`
- `WORKERS_AI_API_TOKEN` — for ingestion REST calls (`/ai/run/<model>`)
- `GOOGLE_GENERATIVE_AI_API_KEY` — for chat (Gemini 2.5 Flash via `@ai-sdk/google`). Get from https://aistudio.google.com/apikey.

## Durable Object naming — load-bearing

- `ResearcherAgent`: single MVP instance, name = `"default"`. In v2, name = authenticated user email.
- `WalletAgent`: one per wallet, name = `address.toLowerCase()`.

Lowercasing matters. Mixed case means two DOs for the same wallet and double the Alchemy CU burn.

## Scope invariants — do not expand without asking

- Ethereum mainnet only. No L2s before M11 ships.
- 200-tx cap per wallet per ingestion (Alchemy free tier + Llama latency).
- No auth. Global singleton `ResearcherAgent` named `"default"`.
- Shadow is read-only. **Never** call `writeContract`, `sendTransaction`, sign anything, or touch private keys. If a feature request implies signing, stop and ask.

## Repo rules

- Repo name must stay `cf_ai_shadow`. The `cf_ai_` prefix is a submission requirement, not a convention.
- `README.md` and `PROMPTS.md` are graded artifacts — keep them current per milestone.
- Never commit secrets, `.env`, or any `wrangler.toml` containing real account IDs/tokens.

## PROMPTS.md protocol — non-negotiable

The assignment requires every AI prompt used on this project to be logged. Two categories, both go in `PROMPTS.md`:

1. **Meta-prompts** — prompts the user typed to you (Claude Code) that drove substantive code generation or architectural decisions. Log these **strict verbatim** — copy the user's message character-for-character, including typos, casing, and phrasing. Do not clean up, paraphrase, translate, or "fix" anything. If the prompt spanned multiple messages in a single exchange, log each message as its own bullet in order. Skip trivial back-and-forth like "fix that typo" or "keep going" — but if you log a prompt, log it untouched.
2. **Application prompts** — prompts Shadow itself sends to Llama 3.3 at runtime: the chat system prompt, the tx-classification template, the dossier-summarization template, any tool-description strings the LLM sees. Log the final version that shipped (not every iteration).

At the end of every milestone, before you run `/shadow-check`:

1. Append to `PROMPTS.md` under a `## M{n} — {milestone name}` heading.
2. Inside, use two subheadings: `### Meta-prompts` and `### Application prompts`.
3. For each prompt, include a one-line note on what it produced and any manual edits made after.
4. If the milestone added no new prompts of a given kind, write "None this milestone" under that subheading — don't omit it.

If `PROMPTS.md` doesn't exist yet, seed it from the template committed at repo root on M1.

## Build order

`plan.md` at repo root is the **single source of truth for execution**. It expands PRD §9 (M1 → M11) into numbered steps with pre-conditions, verification, and commit messages. Do not execute anything not in `plan.md` — if a new step is needed, amend `plan.md` first, commit the amendment, then proceed. Each milestone ends runnable end-to-end; do not start M(n+1) until M(n) works. Commit at every milestone boundary with a message prefixed `M{n}:`.

## Pre-commit check

Run `/shadow-check` before every milestone commit. It runs types, the test suite, and a wrangler dry-run. If it fails, do not commit — surface the failure and stop.

## Class skeletons (shape, not contract)

```ts
// One DO per wallet. DO name = lowercased address.
class WalletAgent extends Agent<Env, WalletState> {
  @callable() async initialize(address: string) { /* set state, kick off IngestWorkflow, schedule refresh */ }
  @callable() async refresh() { /* manual trigger */ }
  @callable() async getDossier() { return this.state.dossier; }
  @callable() async getRecentActivity(limit: number) { /* SQL read */ }
  async scheduledRefresh() { /* wired via this.schedule("*/10 * * * *", "scheduledRefresh") */ }
  async applyDossier(dossier: Dossier, txs: Tx[]) { /* called back from IngestWorkflow */ }
}

// One singleton for MVP. Handles chat + watchlist.
class ResearcherAgent extends AIChatAgent<Env, ResearcherState> {
  @callable() async addToWatchlist(address: string) { /* updates state.watchlist, kicks a WalletAgent */ }
  @callable() async removeFromWatchlist(address: string) { }
  @callable() async getWatchlist() { return this.state.watchlist; }
  async onChatMessage(onFinish) {
    // Build messages + tool defs (queryWallet, compareWallets, listWatched),
    // call env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { stream: true, tools }),
    // route tool calls to WalletAgents via env.WALLET.get(idFromName(address)).
  }
}

// Durable tx ingestion. Triggered by WalletAgent, retries + resumes across reboots.
class IngestWorkflow extends WorkflowEntrypoint<Env, { address: string }> {
  async run(event, step) {
    const txs = await step.do("fetch-txs", () => /* Alchemy */);
    const decoded = await step.do("decode", () => /* Etherscan ABIs, cached in ABI_CACHE */);
    const classified = await step.do("classify", () => /* env.AI.run in batches of 10 */);
    const dossier = await step.do("summarize", () => /* env.AI.run for tags + narrative + risk */);
    await step.do("persist", () => /* RPC back into WalletAgent.applyDossier */);
  }
}
```

## Docs — prefer first-party

- Agents SDK: https://developers.cloudflare.com/agents/
- Workers AI models: https://developers.cloudflare.com/workers-ai/models/
- Workflows: https://developers.cloudflare.com/workflows/
- viem: https://viem.sh

If the Cloudflare Docs MCP is installed, prefer it over web search — faster and always current. Don't invent SDK shapes; if a call looks wrong, look it up.

## When in doubt

If a choice isn't covered here or in `PRD.md`, ask before deciding. Scope creep is the failure mode for this assignment, not missing features.
