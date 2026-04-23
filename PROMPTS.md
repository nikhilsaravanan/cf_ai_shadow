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
