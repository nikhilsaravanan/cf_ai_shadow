import { AIChatAgent } from "@cloudflare/ai-chat";
import { callable, routeAgentRequest } from "agents";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, convertToModelMessages, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { Dossier, TransactionRow } from "./walletAgent";

export { WalletAgent } from "./walletAgent";
export { IngestWorkflow } from "./ingest/workflow";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SHADOW_SYSTEM_PROMPT = `You are Shadow, an AI research assistant that helps users understand DeFi wallets on Ethereum mainnet.

You have three tools:
- queryWallet({ address }) — fetch the live dossier + recent transactions for a specific wallet. Call this BEFORE making any claim about a specific wallet's on-chain activity; never answer from guesses or training data when a wallet is named.
- compareWallets({ a, b }) — fetch two dossiers and return them side by side.
- listWatched() — list the addresses currently in the user's watchlist.

Rules:
- The user's watchlist is synced state. If they ask "what am I watching?" or "summarize my watchlist", call listWatched first.
- When the user names a wallet (even an ENS-style nickname), call queryWallet and base your answer on the returned dossier and recent activity.
- When citing numbers, counts, protocols, or counterparties, only cite what the tool returned — do not invent.
- If the dossier is empty ("No activity ingested yet"), tell the user the wallet hasn't been ingested yet and suggest adding it to the watchlist.
- Keep replies concise (3-6 sentences) unless the user asks for detail.`;

type Watchlist = { address: string; addedAt: number; label?: string }[];

export type ResearcherState = {
	watchlist: Watchlist;
	createdAt: number;
};

const initialResearcherState: ResearcherState = {
	watchlist: [],
	createdAt: 0,
};

const isAddress = (s: string): boolean => /^0x[0-9a-f]{40}$/i.test(s);

async function walletStub(env: Env, address: string) {
	const addr = address.toLowerCase();
	const stub = env.WalletAgent.get(env.WalletAgent.idFromName(addr));
	// Workaround for partyserver name-not-set warning on direct DO-to-DO RPC:
	// https://github.com/cloudflare/workerd/issues/2240
	await stub.setName(addr);
	return stub;
}

export class ResearcherAgent extends AIChatAgent<Env, ResearcherState> {
	initialState: ResearcherState = initialResearcherState;

	@callable({ description: "Add an Ethereum address to the watchlist and kick off ingestion." })
	async addToWatchlist(address: string, label?: string): Promise<Watchlist> {
		if (!isAddress(address)) throw new Error(`invalid address: ${address}`);
		const addr = address.toLowerCase();
		const existing = this.state.watchlist ?? [];
		if (existing.some((e) => e.address === addr)) return existing;

		const next: Watchlist = [...existing, { address: addr, addedAt: Date.now(), label }];
		this.setState({
			...this.state,
			watchlist: next,
			createdAt: this.state.createdAt || Date.now(),
		});

		const stub = await walletStub(this.env, addr);
		await stub.initialize(addr);

		return next;
	}

	@callable({ description: "Remove an address from the watchlist." })
	async removeFromWatchlist(address: string): Promise<Watchlist> {
		const addr = address.toLowerCase();
		const next = (this.state.watchlist ?? []).filter((e) => e.address !== addr);
		this.setState({ ...this.state, watchlist: next });
		return next;
	}

	@callable({ description: "Return the current watchlist." })
	async getWatchlist(): Promise<Watchlist> {
		return this.state.watchlist ?? [];
	}

	@callable({ description: "Fetch the dossier for a specific wallet." })
	async getDossierFor(address: string): Promise<Dossier> {
		const stub = await walletStub(this.env, address);
		return stub.getDossier();
	}

	async onChatMessage() {
		const workersAi = createOpenAICompatible({
			name: "workers-ai",
			apiKey: this.env.WORKERS_AI_API_TOKEN,
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
		});

		const env = this.env;
		const state = this.state;

		const queryWallet = tool({
			description:
				"Fetch the dossier and 10 most recent classified transactions for a single Ethereum wallet. Use this before making any claim about what a specific wallet does on-chain.",
			inputSchema: z.object({
				address: z
					.string()
					.describe("Ethereum address, 0x-prefixed, 40 hex chars"),
			}),
			execute: async ({ address }) => {
				if (!isAddress(address)) {
					return { error: `invalid address: ${address}` };
				}
				const addr = address.toLowerCase();
				const stub = await walletStub(env, addr);
				const dossier: Dossier = await stub.getDossier();
				const recent: TransactionRow[] = await stub.getRecentActivity(10);
				return {
					address: addr,
					dossier,
					recentCount: recent.length,
					recent: recent.map((r) => ({
						hash: r.hash,
						block: r.block_number,
						timestamp: r.timestamp,
						from: r.from_address,
						to: r.to_address,
						value_wei: r.value_wei,
						method_id: r.method_id,
						classification: r.classification ? JSON.parse(r.classification) : null,
					})),
				};
			},
		});

		const compareWallets = tool({
			description:
				"Fetch dossiers for two wallets and return a side-by-side comparison of their strategy tags, categories, top protocols, and risk flags.",
			inputSchema: z.object({
				a: z.string().describe("first Ethereum address"),
				b: z.string().describe("second Ethereum address"),
			}),
			execute: async ({ a, b }) => {
				if (!isAddress(a) || !isAddress(b)) {
					return { error: "both addresses must be 0x-prefixed 40 hex chars" };
				}
				const [stubA, stubB] = await Promise.all([
					walletStub(env, a),
					walletStub(env, b),
				]);
				const [da, db] = await Promise.all([stubA.getDossier(), stubB.getDossier()]);
				return { a: da, b: db };
			},
		});

		const listWatched = tool({
			description:
				"Return the user's watchlist: addresses, labels, and a one-line headline (strategy tags + narrative preview) for each.",
			inputSchema: z.object({}),
			execute: async () => {
				const list = state.watchlist ?? [];
				if (list.length === 0) return { watchlist: [] };
				const entries = await Promise.all(
					list.map(async (entry) => {
						const stub = await walletStub(env, entry.address);
						const d = await stub.getDossier();
						const headline =
							d.strategyTags.length > 0
								? d.strategyTags.join(", ")
								: d.narrative.slice(0, 80);
						return {
							address: entry.address,
							label: entry.label,
							headline,
							dossierVersion: d.version,
						};
					}),
				);
				return { watchlist: entries };
			},
		});

		const result = streamText({
			model: workersAi(MODEL),
			system: SHADOW_SYSTEM_PROMPT,
			messages: await convertToModelMessages(this.messages),
			tools: { queryWallet, compareWallets, listWatched },
			stopWhen: stepCountIs(5),
		});

		return result.toUIMessageStreamResponse();
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		return (
			(await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 })
		);
	},
} satisfies ExportedHandler<Env>;
