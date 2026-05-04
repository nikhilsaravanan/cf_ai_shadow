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

## M9 — Frontend (React + Vite + Tailwind)

### Meta-prompts

None this milestone — M9 executed directly from `plan.md` after a single "go". Trivial approval messages are not logged per the protocol.

### Application prompts

None this milestone — M9 is UI-only (React panels wired to `useAgent` + `useAgentChat`). No new LLM calls introduced; the chat system prompt and tool descriptions from M8 are reused verbatim.

---

## M9.1 — SPA redesign (Figma-derived design language)

### Meta-prompts

- Redesign request — drove the full restyle of `App.tsx`, `Watchlist`, `Dossier`, `Chat`, plus brand tokens in `index.css` and Manrope/JetBrains Mono in `index.html`. The Figma file was fetched via the Figma MCP (`get_screenshot` on node `0:1`).

  > i want to redesign our frontend spa completely, using https://www.figma.com/design/HImdZuYV3DEp8RiGzgdjkH/CRYPTO-DASHBOARD--Community-?node-id=0-1&m=dev&t=Z5CuVCVDLqNShsh8-1. use the figma mcp to get the dashboard design and model ours after the elements in that. it doesnt have to be exact, but i want a similar design language

  - Produced: brand-yellow `#f4d442` accent, near-black canvas, rounded-2xl elevated cards; new component layout — yellow Moon logo in header, sidebar Watchlist with avatar circles, Dossier hero card + 4-stat row + yellow Strategy callout + Narrative card + protocols/counterparties grid + risk-flag rows, Chat with yellow user bubbles and circular ArrowUp Send.
  - Manual edits: scoped Playwright selectors to `data-testid="dossier-narrative"`, `li[data-role="assistant"]`, and the brand-yellow Strategy card's list items so the e2e suite still passes against the new DOM.

- Follow-up confirming the proposed plan and the two questions about font + icon dep:

  > go, and 3 and 4 are ok

  - Produced: confirmation to (3) load Manrope via Google Fonts in `index.html`, and (4) add `lucide-react` (^1.11.0) for sidebar / header / chat icons.

### Application prompts

None this milestone — pure UI/styling pass; no new LLM calls or prompt changes.

---

## M9.2 — Incremental ingest (cost fix)

### Meta-prompts

- Diagnosis question that triggered the cost-fix work:

  > the quota is back but do you think we are doing something to expend the usage limits instantly every time? heres the terminal log: [WalletAgent:0x28c…] scheduledRefresh firing … [classify] batch N attempt 0 threw: Workers AI 429: …

  - Produced: a math-grounded diagnosis identifying three causes — (1) `fetchWalletTxs` re-fetches the latest 200 txs every refresh with no `fromBlock`; (2) `classifyTxs` re-classifies all of them every cycle; (3) the `*/10` cron across N watched wallets can burn ~378 AI calls/hr against a 10k-neuron daily budget. Drove the M9.2 plan amendment.

- Pushback that corrected the watchlist-trim suggestion in favor of caching:

  > for 4, why would we delete other wallets, cant we just cache the data to avoid rerunning the calls?

  - Produced: refined recommendation — replace "trim watchlist" with (a) classification reuse from SQLite by hash, (b) skip-summarize on no-op refreshes, (c) move aggregation into the WalletAgent so it always reflects the full SQL history rather than just the in-flight workflow batch.

- Approval to ship:

  > yes

  - Produced: `plan.md` amendment (commit `e42d55d`) + the implementation in this commit.

### Application prompts

None this milestone — pure ingest-pipeline restructuring; no new prompts. The classify and summarize prompts from M4 / M5 are reused unchanged.

---

## M9.3 — Pin lastSyncedBlock + smaller incremental cap

### Meta-prompts

- Live observation that surfaced the M9.2 bug:

  > [terminal log of multiple scheduledRefresh cycles showing `[classify] N new txs, 0 reused from cache` for varying N, all hitting 429 and short-circuiting] heres the terminal message. if you use playwright cli to navigate to the localhost you will see that the number of transactions ingested keeps increasing after each run. is this a cause of the problem?

  - Produced: diagnosis that `lastSyncedBlock` was advancing past unclassified txs even when all classifications failed, leaving permanent null-classification rows when the LLM was 429ing. Identified the secondary risk that a hot wallet's 200-tx catch-up burst could blow the daily quota in one cycle on recovery.

- Approval to ship both fixes:

  > ship the fix and bundle the max reduction

  - Produced: `plan.md` amendment (commit `fc603d0`) + the implementation in this commit.

### Application prompts

None this milestone — fix is to ingestion accounting / fetch-cap; no prompt changes.

---

## M9.4 — Second SPA redesign (light theme, yellow + orange, Inter)

### Meta-prompts

- Second redesign request — drove the wholesale token + component restyle. Figma file fetched via `get_screenshot` on node `0:1`.

  > i want to redesign the frontend, model the new design after this figma design:https://www.figma.com/design/DwlwgiTrrX29mQHWxZMDiz/Dashboard%E7%BB%83%E4%B9%A0--Community-?node-id=0-1&t=ChalhZ6OSDvBWt2n-1 i want the same functionality as the current frontend, just update the ui

  - Produced: light-theme card aesthetic, COINSPACE-style sidebar with deterministic-palette avatar chips, breadcrumb header, 4-stat row, white wallet-detail card with strategy-tag pills + risk-flag rows, Top protocols / counterparties two-up cards, newsfeed-style chat bubbles with gradient user fill + accent stripe on assistant cards.

- Decision answers on the three open questions:

  > 3 panel, inter, use yellow and orange branding, go

  - Produced: kept three-panel layout (Watchlist / Dossier / Chat), swapped Manrope→Inter, brand palette set to yellow `#f5b800` + orange `#f97316` (gradients between them used for active states + send button + user bubble fill).

### Application prompts

None this milestone — pure UI/styling pass; no new LLM calls or prompt changes.

---

## M9.5 — Structural port of the Figma redesign

### Meta-prompts

- Corrective on M9.4 — the prior redesign was a token swap layered on the prior structure rather than an actual port:

  > copy more of the design from the new figma template, the frontend still just looks like the old design with colors changed. use playwright whenever youre working on uiux to debug yourself

  - Produced: M9.5 plan amendment + structural rewrite. Layout flipped from `[header / [sidebar | center | chat]]` to `[sidebar | (header / [center | rightRail])]`. New components: `Sparkline.tsx` (deterministic-from-seed inline-SVG area chart) and `RightRail.tsx` (Top Protocols + Chat stacked, shared `useAgent` instance). Watchlist became a multi-section nav (Quick Access / Watchlist / Service / Account) with branded header + bottom Log out. Dossier got tabbed wallet hero (Overview / Activity / Risk), protocol-breakdown stacked bar, and a `LatestActivitiesCard` pulling `walletAgent.stub.getRecentActivity(20)` via `useEffect`.
  - Manual edits: also added a `feedback_uiux_iterate_with_playwright.md` memory entry to enforce screenshot-between-changes for future UI work.

### Application prompts

None this milestone — pure UI/structural pass; no new LLM calls or prompt changes.

---

## M9.6 — Glassmorphism pass

### Meta-prompts

- Glassmorphism request — drove the surface treatment change (canvas → dark, cards → frosted glass, ambient color blobs, stat-card gradient bleeds). Two Figma references provided for inspiration (general glassmorphism mobile kit + glassmorphism dashboard); the dashboard ref is closer to Shadow's layout and dictated the dark + bleed-through aesthetic.

  > i want to implement a glassmorphism design to the spa, especially with the cards in the dossier. use the elements from the two figma links i give you for inspiration on design for the ui. https://www.figma.com/design/dfjpw35nbwK6eV95AscNYy/%F0%9F%99%80-Glassmorphism-is-on-Figma---Community-?node-id=1-1083&t=bqm4g0uAZAhOGobm-1 https://www.figma.com/design/CeFvgu01lHA1n1anuH7sG4/Dashboard-Glassmorphism--Community-?node-id=0-1&p=f&t=b0qAmJJpzJm4KnHC-0

  - Produced: tokens flipped to dark canvas + light-on-dark text. New `BackgroundBlobs` component in `App.tsx` painting 5 blurred radial gradients (yellow, orange, violet, teal, pink) as ambient lighting. New `.glass` / `.glass-soft` utility classes in `index.css` for the frosted recipe (semi-transparent fill + backdrop-blur + saturate + white-line top edge inset shadow). Stat cards restructured to a 3-layer stack: vivid color bleed → subtle frosted overlay → top-edge highlight → content on z-10. Watchlist sidebar uses a softer glass (`bg-white/[0.04]` + backdrop-blur). Chat assistant bubbles became frosted glass; user bubbles keep the yellow→orange gradient fill.
  - Manual edits: iterated 6 screenshot-vs-Figma cycles before the bleeds read clearly — original two-radial bleed was washed out by `backdrop-blur-xl` overlay; settled on `linear-gradient + radial-gradient` combo with `backdrop-blur-md` (less aggressive) so per-card color reads through. Kept three-panel layout untouched from M9.5.

- Follow-up correction (v2 iteration of the same pass) — initial M9.6 still felt "solid" and the brand gradients on buttons/chat were too prominent for a glass aesthetic:

  > the cards still look solid, make them more like the cards in the figma template, and change the buttons and chats from gradient as well. https://www.figma.com/design/7vOVMqiFuSvmP6ArKxhr98/Dashboard-Glassmorphism--Community-?node-id=0-1&t=qsMCQqDVtdMgoZRt-1

  - Produced: bleed gradient bumped from `linear+radial` to `radial-gradient(circle at varied origin, color-cc 0%, color-66 25%, color-22 50%, transparent 80%)` so each card's bleed covers more area and per-card origin varies (bottom-left / top-right / top-left / bottom-right) for visual rhythm. All `bg-gradient-to-r/br from-brand to-brand-2` brand gradients across App, Watchlist, Dossier, Chat (avatar, logomark, active sidebar items, Add submit, Refresh button, tab underlines, strategy tag pills, Send button, user-bubble fill, assistant-bubble accent stripe) replaced with glass chips: `border border-white/20 bg-white/10 backdrop-blur-md` for neutral, `border border-brand/30 bg-brand/15 backdrop-blur-md` for brand-tinted. Only the white-line top-edge highlight on stat cards retains a `gradient-to-r from-transparent via-white/30 to-transparent` (it's the glass shine, not a brand gradient).

- Second correction (v3 iteration of M9.6) — sidebar buttons + chat looked too austere as glass chips, and the stat-card bleeds read as random "dot" spotlights rather than light reflecting off the chart inside the card:

  > revert the buttons on the left sidebar back, and make the chats like that too. as for the dossier cards, dont use the dots as a "light source" make the glass reflect the light from the graphs

  - Produced: brand gradients **restored** on Watchlist (logomark, active wallet rows, active nav rows, Add submit) and Chat (Send button, user-bubble fill, assistant-bubble accent stripe). Stat-card bleed redesigned to a vertical light-rises-from-the-chart pattern — `linear-gradient(to top, color-b3 0%, color-55 22%, color-22 45%, transparent 75%)` plus a wider bottom-edge `radial-gradient(120% 100% at 50% 100%, color-99, transparent 70%)` anchored where the sparkline sits, so the card's color appears emitted by the chart line below it. Sparkline reworked to a two-stroke "filament": a wide `${color}` halo at 70% opacity with a Gaussian-blur SVG filter (light-source halo) plus a thin bright-white 95% core stroke (the filament itself) on top of the area-fill. The card glass now visibly reflects the chart's light upward.

### Application prompts

None this milestone — pure surface-treatment pass; no new LLM calls or prompt changes.

---

## M9.7 — Chat model swap (Workers AI Llama 3.3 → Gemini 2.5 Flash via `@ai-sdk/google`)

### Meta-prompts

- `can we use a different model for chat and keep the same app functionality`
  - Produced: opened the discussion of where the chat path could move; surfaced the constraint that the original CLAUDE.md pin to `@cf/meta/llama-3.3-70b-instruct-fp8-fast` was costing ~1–2k neurons per chat turn against a 10k/day free quota.
  - Manual edits: none.
- `i want the chat quality to match what we saw today, and i think ingestion can stay on the current model as its working fine. for chat, however, do you think it would be beneficial to use an external model outside of workers ai?`
  - Produced: locked the quality target to the M8 narration pattern ("vitalik uses Curve / Aave V3 lender / Uniswap V3..."), confirmed ingestion stays on Workers AI Llama 3.1 8B, opened the external-LLM question.
  - Manual edits: none.
- `the instructions read  LLM (recommend using Llama 3.3 on Workers AI), or an external LLM of your choice", so i think we're fine to use an external model as well. would you say gemini or mistral would be a good choice? the reason i think an external llm would be better is to bypass the 10k neurons limit for chat, and keep the limit focused on ingestion for the app, as chat takes up more tokens`
  - Produced: confirmed the assignment allows external LLM; locked the workload split (chat → external, ingestion → Workers AI); narrowed model choice to Gemini vs Mistral. Final pick: `gemini-2.5-flash` via `@ai-sdk/google` (chosen for free-tier generosity, tool-calling reliability, and JS SDK polish).
  - Manual edits: none.

### Application prompts

None this milestone — chat system prompt (`SHADOW_SYSTEM_PROMPT` in `src/server.ts`) is unchanged from M8 and already logged. The model + provider changed; the prompt did not.

---

## M10 — Polish + first real deploy

### Meta-prompts

- `i want to continue development of this project to a deployable state. previously we were working on the ui, as indicated by plan.md and the git history. i like the ui, and the chat works so i want to continue along the plan stages`
  - Produced: scoped the remaining work to plan.md M10 + M11 (polish: favicon, loading + error toasts; rewrite "Pages" → single Worker + assets language in PRD; first real `wrangler deploy`; verify scheduled refresh; finalize README + PROMPTS; push to GitHub) and surfaced the gating decision (real deploy vs ready-to-deploy).
  - Manual edits: none.
- `b for q1 and yes git push on your own for q2`
  - Produced: authorization to (a) execute the first real `wrangler deploy` against the user's Cloudflare account (M10 step 4) and (b) push the M10/M11 commits to `origin/main` (M11 step 8). Authorization scope is one-shot, not standing — future deploys / pushes still need explicit consent per CLAUDE.md.
  - Manual edits: none.
- `ive logged in` (after Claude Code prompted `! npx wrangler login`)
  - Produced: signal that wrangler OAuth completed and `wrangler secret put` / `wrangler deploy` were unblocked. Triggered the four-secret upload (`ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY`, `WORKERS_AI_API_TOKEN`, `GOOGLE_GENERATIVE_AI_API_KEY`) and the first real deploy (`https://cf_ai_shadow.nikhilsaravanan8.workers.dev`).
  - Manual edits: none.

### Application prompts

None this milestone — polish was UI/infra-only (favicon, Toast component + provider, refresh-button spinner + error toast in `Dossier.tsx`, chat error/tool-error toasts in `Chat.tsx`, PRD scrub of "Pages" language). No new LLM calls, no chat/classification/summary prompt changes.

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
