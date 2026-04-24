import type { Classification } from "../walletAgent";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const BATCH_SIZE = 10;
const MAX_TOKENS = 2000;

const VALID_CATEGORIES = [
	"swap",
	"lp",
	"lending",
	"transfer",
	"bridge",
	"governance",
	"airdrop",
	"mint",
	"other",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

export type TxToClassify = {
	to: string | null;
	from: string;
	valueWei: string;
	methodId: string | null;
	decodedInput: string | null;
};

export type AiCreds = {
	accountId: string;
	apiToken: string;
};

export const CLASSIFICATION_SYSTEM_PROMPT = `You are classifying Ethereum transactions for a DeFi wallet research tool. For each transaction, produce:
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

If decoded_input is null or the counterparty is unknown, infer from method_id and value. When unsure, use category "other" with protocol null — do not guess a protocol.`;

function ethFrom(wei: string): string {
	try {
		const n = Number(BigInt(wei)) / 1e18;
		return n.toFixed(6);
	} catch {
		return "0";
	}
}

function buildUserPrompt(selfAddress: string, batch: TxToClassify[]): string {
	const items = batch.map((t, i) => {
		let decoded: unknown = null;
		if (t.decodedInput) {
			try {
				decoded = JSON.parse(t.decodedInput);
			} catch {
				decoded = t.decodedInput;
			}
		}
		return {
			index: i,
			direction: t.from === selfAddress ? "out" : "in",
			counterparty: t.from === selfAddress ? t.to : t.from,
			value_eth: ethFrom(t.valueWei),
			method_id: t.methodId,
			decoded,
		};
	});
	return `Wallet under analysis: ${selfAddress}

Classify these ${batch.length} transactions. Return a JSON array with exactly ${batch.length} objects, one per input transaction in the same order. Each object must have exactly these keys: category, protocol, notes. Return ONLY the JSON array — no prose, no code fences, no markdown.

Transactions:
${JSON.stringify(items, null, 2)}`;
}

function stripFences(raw: string): string {
	return raw
		.replace(/^\s*```(?:json)?\s*/i, "")
		.replace(/\s*```\s*$/i, "")
		.trim();
}

function extractJsonArray(raw: string): string {
	const stripped = stripFences(raw);
	const start = stripped.indexOf("[");
	const end = stripped.lastIndexOf("]");
	if (start === -1 || end === -1 || end <= start) return stripped;
	return stripped.slice(start, end + 1);
}

function normalize(raw: unknown, expectedLen: number): Classification[] | null {
	if (!Array.isArray(raw) || raw.length === 0) return null;
	const out: Classification[] = [];
	for (let i = 0; i < expectedLen; i++) {
		const item = raw[i] as Record<string, unknown> | undefined;
		if (!item || typeof item !== "object") {
			out.push({ category: "other", notes: "unclassified" });
			continue;
		}
		const catRaw = typeof item.category === "string" ? item.category.toLowerCase() : "other";
		const category: Category = (VALID_CATEGORIES as readonly string[]).includes(catRaw)
			? (catRaw as Category)
			: "other";
		const protocol =
			typeof item.protocol === "string" && item.protocol.trim().length > 0
				? item.protocol
				: undefined;
		const notes = typeof item.notes === "string" ? item.notes : "";
		out.push({ category, protocol, notes });
	}
	return out;
}

async function callLlama(
	creds: AiCreds,
	userPrompt: string,
	strictReminder: boolean,
): Promise<string> {
	const userContent = strictReminder
		? `${userPrompt}\n\nReturn ONLY raw JSON, no code fences, no commentary, no keys other than category/protocol/notes.`
		: userPrompt;
	const res = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/ai/run/${MODEL}`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${creds.apiToken}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				messages: [
					{ role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
					{ role: "user", content: userContent },
				],
				max_tokens: MAX_TOKENS,
			}),
		},
	);
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Workers AI ${res.status}: ${body.slice(0, 200)}`);
	}
	const json = (await res.json()) as {
		success?: boolean;
		result?: { response?: string };
		errors?: { message: string }[];
	};
	if (json.success === false) {
		throw new Error(`Workers AI error: ${json.errors?.[0]?.message ?? "unknown"}`);
	}
	return json.result?.response ?? "";
}

async function classifyBatch(
	creds: AiCreds,
	selfAddress: string,
	batch: TxToClassify[],
): Promise<(Classification | null)[]> {
	const userPrompt = buildUserPrompt(selfAddress, batch);
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const raw = await callLlama(creds, userPrompt, attempt > 0);
			const jsonText = extractJsonArray(raw);
			const parsed = JSON.parse(jsonText);
			const normalized = normalize(parsed, batch.length);
			if (normalized) return normalized;
		} catch {
			// fall through to retry or null fallback
		}
	}
	return new Array<Classification | null>(batch.length).fill(null);
}

export async function classifyTxs(
	creds: AiCreds,
	selfAddress: string,
	txs: TxToClassify[],
): Promise<(Classification | null)[]> {
	const out: (Classification | null)[] = [];
	for (let i = 0; i < txs.length; i += BATCH_SIZE) {
		const batch = txs.slice(i, i + BATCH_SIZE);
		const results = await classifyBatch(creds, selfAddress, batch);
		out.push(...results);
	}
	return out;
}
