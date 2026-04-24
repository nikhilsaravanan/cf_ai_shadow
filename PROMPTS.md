# PROMPTS.md

Log of AI prompts used during the build of `cf_ai_shadow` (Shadow).

Two kinds of prompts are tracked here:

- **Meta-prompts** — prompts the author (Nikhil) typed to Claude Code during development that drove substantive code or decisions.
- **Application prompts** — prompts Shadow itself sends to Llama 3.3 at runtime (chat system prompt, tx-classification template, dossier-summarization template, tool descriptions).

Organized by milestone. Within each milestone, meta- and application prompts are separated. See `CLAUDE.md` for the logging protocol.

---

## M0 — Planning (pre-scaffold)

### Meta-prompts

- Brainstorming / idea-selection session with an assistant (Cowork mode, Opus 4.7) — produced the PRD, CLAUDE.md, and this file's template. Full session not reproduced here; output artifacts are the PRD and this doc.

- Kicking off the project in Claude Code — produced `plan.md`, M0 layout flatten, and the CLAUDE.md corrections (useAgentChat import path, tsconfig rule, Pages → Worker+assets):

  > i want to start working on a project using cloudflare's agent building platform according to the instructions below
  >
  > Optional Assignment Instructions: We plan to fast track review of candidates who complete an assignment to build a type of __AI-powered application__ on Cloudflare. An AI-powered application should include the following components:
  >
  > LLM (recommend using Llama 3.3 on Workers AI), or an external LLM of your choice
  > Workflow / coordination (recommend using Workflows, Workers or Durable Objects)
  > User input via chat or voice (recommend using Pages or Realtime)
  > Memory or state
  > Find additional documentation __here__.
  >
  > __IMPORTANT NOTE:__ To be considered, your repository name must be prefixed with cf_ai_, must include a README.md file with project documentation and clear running instructions to try out components (either locally or via deployed link). AI-assisted coding is encouraged, but you must include AI prompts used in PROMPTS.md
  >
  > All work must be original; copying from other submissions is strictly prohibited. read the PRD document for information about the app, every choice you make should be consistent with it. refer to claude.md, and after reading it, report back to me with changes you would like to make to it after your review of the project scope. you can refer to https://developers.cloudflare.com/agents/ using playwright for documentation or information about the cloudflare agents you will be working with. the starter agent is already installed in the project directory. before you write or change any code, create a plan.md file that houses the step by step implementation plan that you will follow. this should be the source of truth for all execution; nothing should be executed before being run by plan.md.

- Follow-up that pinned the three layout/deploy decisions the plan depends on (flatten repo, single Worker + assets, chat-agent docs as reference):

  > you can follow the documentation at https://developers.cloudflare.com/agents/getting-started/build-a-chat-agent/ to build the agents. for the layout, flatten it to one repo. Single Worker with assets binding. Update the README and any doc language that says 'Pages' to 'single Worker with assets binding' when you get to M10/M11.

### Application prompts

None this milestone.

---

## M1 — Scaffold

### Meta-prompts

None this milestone — M1 executed directly from `plan.md` after the user approved the plan with a single "go". Per the PROMPTS.md protocol, trivial approval messages are not logged.

### Application prompts

- **Shadow chat system prompt (M1 placeholder).** Used by `ChatAgent.onChatMessage` in `src/server.ts` when calling `streamText` against `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Will be replaced in M8 when the `queryWallet` / `compareWallets` / `listWatched` tool surface lands.

  ```
  You are Shadow, an AI research assistant that helps users understand DeFi wallets on Ethereum mainnet. The tool surface for querying wallets is still being built; answer general questions helpfully and, when asked about a specific wallet, say that wallet-lookup tools will be wired up in a later milestone.
  ```

---

## M2 — WalletAgent skeleton

### Meta-prompts

None this milestone — M2 executed directly from `plan.md` after a single "go". Trivial approval messages are not logged per the protocol.

### Application prompts

None this milestone (WalletAgent M2 is state + SQLite skeleton only; no LLM calls. Classification and summarization templates land in M4 and M5 respectively).

---

## M3 — Transaction ingestion (no LLM)

### Meta-prompts

None this milestone — M3 executed directly from `plan.md` after a single "go". Trivial approval messages are not logged per the protocol.

### Application prompts

None this milestone (M3 is Alchemy + Etherscan + viem wiring; no LLM calls. Classification and summarization templates land in M4 and M5 respectively).

---

## M4 — Classify txs with Llama 3.3

### Meta-prompts

None this milestone — M4 executed directly from `plan.md` after a single "go". A mid-milestone pivot (see `plan: pivot Workers AI invocation from env.AI.run to REST fetch`, commit `59a4803`) was triggered by the miniflare AI-binding bug and was committed as a separate plan amendment per the deviation policy; no new user meta-prompt drove it.

### Application prompts

- **Classification system prompt (M4).** Used by `classifyTxs` in `src/ingest/classifyTxs.ts` when calling `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via the Cloudflare Workers AI REST endpoint. Batched 10 txs at a time; retried once on parse failure with an explicit "return only raw JSON" reminder appended to the user turn.

  ```
  You are classifying Ethereum transactions for a DeFi wallet research tool. For each transaction, produce:
  - category: exactly one of "swap", "lp", "lending", "transfer", "bridge", "governance", "airdrop", "mint", "other"
  - protocol: the DeFi protocol name (e.g., "Uniswap V3", "Aave V3", "Curve", "1inch", "Lido", "OpenSea") or null if unknown or not applicable
  - notes: a one-sentence description of what happened (max 20 words)

  Category definitions:
  - swap: token-for-token exchange on a DEX (Uniswap, Curve, 1inch, SushiSwap, CoW, 0x, Paraswap)
  - lp: adding or removing liquidity from an AMM pool
  - lending: deposit, borrow, repay, or withdraw on a lending protocol (Aave, Compound, Spark, Morpho)
  - transfer: plain ETH or ERC-20 transfer with no contract method call of interest
  - bridge: cross-chain bridge deposit or withdrawal (Arbitrum, Optimism, Base canonical bridges; Wormhole; Across; Hop; Stargate)
  - governance: DAO vote, delegate, queue, or execute proposal
  - airdrop: claiming a token airdrop (claim / merkleClaim style methods)
  - mint: minting an NFT or token (ERC-721/1155 mint, or fresh ERC-20 mint)
  - other: does not fit the above categories

  If decoded_input is null or the counterparty is unknown, infer from method_id and value. When unsure, use category "other" with protocol null — do not guess a protocol.
  ```

- **Classification user-turn template (M4).** Rendered per batch with `selfAddress` and the list of decoded txs as JSON:

  ```
  Wallet under analysis: {selfAddress}

  Classify these {N} transactions. Return a JSON array with exactly {N} objects, one per input transaction in the same order. Each object must have exactly these keys: category, protocol, notes. Return ONLY the JSON array — no prose, no code fences, no markdown.

  Transactions:
  {JSON.stringify(items, null, 2)}
  ```

  On retry (attempt 2), the following reminder is appended to the user turn:

  ```
  Return ONLY raw JSON, no code fences, no commentary, no keys other than category/protocol/notes.
  ```

---

## M5 — Dossier summarization

### Meta-prompts

None this milestone — M5 executed directly from `plan.md` after a single "go". Trivial approval messages are not logged per the protocol.

### Application prompts

- **Dossier summarization system prompt (M5).** Used by `summarizeDossier` in `src/ingest/summarizeDossier.ts` after classify. Called once per refresh against `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via the Cloudflare Workers AI REST endpoint; retried once on parse failure with an explicit "return only raw JSON" reminder appended to the user turn.

  ```
  You are writing a wallet dossier for a DeFi research tool. Given transaction aggregations and a sample of recent activity for an Ethereum mainnet wallet, produce three fields:

  - strategyTags: an array of 1-6 short tags (each 2-4 words) describing the wallet's DeFi profile. Examples: "DEX power user", "LST accumulator", "NFT minter", "bridge user", "lending borrower", "governance participant", "MEV searcher", "airdrop farmer", "stablecoin holder". Choose tags that are actually supported by the data.
  - narrative: a 3-5 sentence plain-English summary of what this wallet does on-chain. Cite specific protocols, categories, and counts from the provided aggregations. Do not invent numbers.
  - riskFlags: an array of flag objects, each with "severity" ("info" | "warn" | "high") and "message" (one sentence, max 20 words). Use "info" for neutral observations, "warn" for unusual patterns (e.g. many failed-looking method IDs, high concentration to one counterparty), "high" for clear red flags (known scam contracts, draining patterns). Return [] when nothing stands out.

  Rules:
  - Base everything on the provided data. Do not invent tx counts, protocol names, or counterparty addresses.
  - If the data is thin (few txs, few classifications), say so in the narrative and keep strategyTags short.
  - Return ONLY a single JSON object with exactly these three keys (strategyTags, narrative, riskFlags). No prose, no code fences, no markdown.
  ```

- **Dossier summarization user-turn template (M5).** Rendered once per refresh with aggregations + a sample of up to 20 recent classified txs:

  ```
  Wallet: {selfAddress}
  Total transactions ingested: {totalTxs}
  Successfully classified: {classifiedTxs}
  Date range: {firstSeen YYYY-MM-DD} to {lastSeen YYYY-MM-DD}

  Category counts:
  {JSON.stringify(categoryCounts, null, 2)}

  Top protocols (from classified txs, up to 5):
  {JSON.stringify(topProtocols, null, 2)}

  Top counterparties (up to 5):
  {JSON.stringify(topCounterparties, null, 2)}

  Recent classified transactions (sample, up to 20):
  {JSON.stringify(samples, null, 2)}

  Return ONLY the JSON object { strategyTags, narrative, riskFlags }.
  ```

  On retry (attempt 2), the following reminder is appended to the user turn:

  ```
  Return ONLY raw JSON for the object { strategyTags, narrative, riskFlags } — no code fences, no commentary.
  ```

---

## M6 — Durable ingestion via IngestWorkflow

### Meta-prompts

None this milestone — M6 executed directly from `plan.md` after a single "go". A mid-milestone plan amendment (`aff9b4b`) fixed §0-convention drift on the Workflow/DO binding names; no user meta-prompt drove it.

### Application prompts

None this milestone — M6 moves the existing classify (M4) and summarize (M5) calls from `WalletAgent.refresh()` into `IngestWorkflow`'s `classify` and `summarize` steps. The application prompts themselves are unchanged (logged under M4 and M5). No new LLM calls introduced.

---

## M7 — Scheduled refresh

### Meta-prompts

None this milestone — M7 executed directly from `plan.md` after a single "go". Trivial approval messages are not logged per the protocol.

### Application prompts

None this milestone — M7 wires `this.schedule("*/10 * * * *", "scheduledRefresh")` inside `WalletAgent.initialize()`. `scheduledRefresh()` debounces on `state.updatedAt < 9min` and otherwise calls `refresh()`, which triggers the existing `IngestWorkflow`. No new LLM calls introduced.

---

## M8 — ResearcherAgent + LLM tools

### Meta-prompts

None this milestone — M8 executed directly from `plan.md` after a single "go". A mid-milestone plan amendment (`de034f0`) fixed §0-convention drift on the DO binding names and pinned the chat-path pivot pre-flagged by the M4 deviation (workers-ai-provider + `env.AI` → `@ai-sdk/openai-compatible` + REST); no user meta-prompt drove it.

### Application prompts

- **Shadow chat system prompt (M8).** Used by `ResearcherAgent.onChatMessage` in `src/server.ts`. Sent via `streamText` through `@ai-sdk/openai-compatible` hitting `https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1/chat/completions` with model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Replaces the M1 placeholder.

  ```
  You are Shadow, an AI research assistant that helps users understand DeFi wallets on Ethereum mainnet.

  You have three tools:
  - queryWallet({ address }) — fetch the live dossier + recent transactions for a specific wallet. Call this BEFORE making any claim about a specific wallet's on-chain activity; never answer from guesses or training data when a wallet is named.
  - compareWallets({ a, b }) — fetch two dossiers and return them side by side.
  - listWatched() — list the addresses currently in the user's watchlist.

  Rules:
  - The user's watchlist is synced state. If they ask "what am I watching?" or "summarize my watchlist", call listWatched first.
  - When the user names a wallet (even an ENS-style nickname), call queryWallet and base your answer on the returned dossier and recent activity.
  - When citing numbers, counts, protocols, or counterparties, only cite what the tool returned — do not invent.
  - If the dossier is empty ("No activity ingested yet"), tell the user the wallet hasn't been ingested yet and suggest adding it to the watchlist.
  - Keep replies concise (3-6 sentences) unless the user asks for detail.
  ```

- **Tool descriptions (M8).** Included in every chat turn's tool catalog sent to Llama.

  `queryWallet`:
  ```
  Fetch the dossier and 10 most recent classified transactions for a single Ethereum wallet. Use this before making any claim about what a specific wallet does on-chain.
  ```
  Input schema: `{ address: string (0x-prefixed, 40 hex chars) }`.

  `compareWallets`:
  ```
  Fetch dossiers for two wallets and return a side-by-side comparison of their strategy tags, categories, top protocols, and risk flags.
  ```
  Input schema: `{ a: string, b: string }` (both Ethereum addresses).

  `listWatched`:
  ```
  Return the user's watchlist: addresses, labels, and a one-line headline (strategy tags + narrative preview) for each.
  ```
  Input schema: `{}` (no args).

---

<!--
Template for future milestones — copy this block at the end of each milestone, fill it in, then commit.

## M{n} — {milestone name}

### Meta-prompts

- <prompt verbatim or near-verbatim>
  - Produced: <what it generated>
  - Manual edits: <what you changed after, or "none">

### Application prompts

- <prompt name, e.g. "Classification template v1">
  ```
  <final prompt text that shipped>
  ```
  - Used by: <which component>
  - Model call: `env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", ...)`
  - Manual edits: <iteration notes if worth noting>

-->
