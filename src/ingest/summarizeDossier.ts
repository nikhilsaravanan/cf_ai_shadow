import type { AiCreds } from "./classifyTxs";
import type { Classification, RiskFlag } from "../walletAgent";

// Same neuron-cost reasoning as classify (see classifyTxs.ts comment).
const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_TOKENS = 1500;

export type ClassifiedTx = {
	hash: string;
	blockNumber: number;
	timestamp: number;
	from: string;
	to: string | null;
	valueWei: string;
	methodId: string | null;
	decodedInput: string | null;
	classification: Classification | null;
};

export type Aggregations = {
	totalTxs: number;
	classifiedTxs: number;
	firstSeen: number;
	lastSeen: number;
	categoryCounts: Record<string, number>;
	topProtocols: { protocol: string; interactionCount: number }[];
	topCounterparties: { address: string; label?: string; count: number }[];
};

export type SampleTx = {
	hash: string;
	direction: "in" | "out";
	counterparty: string | null;
	valueEth: string;
	category: string | null;
	protocol: string | null;
	notes: string | null;
};

export type SummaryOutput = {
	strategyTags: string[];
	narrative: string;
	riskFlags: RiskFlag[];
};

const VALID_SEVERITIES = ["info", "warn", "high"] as const;

function valueEthOf(wei: string): string {
	try {
		return (Number(BigInt(wei)) / 1e18).toFixed(6);
	} catch {
		return "0";
	}
}

export function aggregateClassified(selfAddress: string, txs: ClassifiedTx[]): Aggregations {
	let firstSeen = Number.POSITIVE_INFINITY;
	let lastSeen = 0;
	const categoryCounts: Record<string, number> = {};
	const protocolCounts = new Map<string, number>();
	const counterpartyCounts = new Map<string, number>();

	for (const t of txs) {
		if (t.timestamp > 0) {
			if (t.timestamp < firstSeen) firstSeen = t.timestamp;
			if (t.timestamp > lastSeen) lastSeen = t.timestamp;
		}
		if (t.classification) {
			const cat = t.classification.category;
			categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
			if (t.classification.protocol) {
				const p = t.classification.protocol;
				protocolCounts.set(p, (protocolCounts.get(p) ?? 0) + 1);
			}
		}
		const cp = t.from === selfAddress ? t.to : t.from;
		if (cp) counterpartyCounts.set(cp, (counterpartyCounts.get(cp) ?? 0) + 1);
	}

	const topProtocols = [...protocolCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([protocol, c]) => ({ protocol, interactionCount: c }));

	const topCounterparties = [...counterpartyCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([address, c]) => ({ address, count: c }));

	return {
		totalTxs: txs.length,
		classifiedTxs: txs.filter((t) => t.classification !== null).length,
		firstSeen: firstSeen === Number.POSITIVE_INFINITY ? 0 : firstSeen,
		lastSeen,
		categoryCounts,
		topProtocols,
		topCounterparties,
	};
}

export function sampleForSummary(
	selfAddress: string,
	txs: ClassifiedTx[],
	limit: number,
): SampleTx[] {
	return txs
		.filter((t) => t.classification !== null)
		.slice()
		.sort((a, b) => b.blockNumber - a.blockNumber)
		.slice(0, limit)
		.map((t) => {
			const outgoing = t.from === selfAddress;
			return {
				hash: t.hash,
				direction: outgoing ? ("out" as const) : ("in" as const),
				counterparty: outgoing ? t.to : t.from,
				valueEth: valueEthOf(t.valueWei),
				category: t.classification?.category ?? null,
				protocol: t.classification?.protocol ?? null,
				notes: t.classification?.notes ?? null,
			};
		});
}

export const SUMMARIZATION_SYSTEM_PROMPT = `You are writing a wallet dossier for a DeFi research tool. Given transaction aggregations and a sample of recent activity for an Ethereum mainnet wallet, produce three fields:

- strategyTags: an array of 1-6 short tags (each 2-4 words) describing the wallet's DeFi profile. Examples: "DEX power user", "LST accumulator", "NFT minter", "bridge user", "lending borrower", "governance participant", "MEV searcher", "airdrop farmer", "stablecoin holder". Choose tags that are actually supported by the data.
- narrative: a 3-5 sentence plain-English summary of what this wallet does on-chain. Cite specific protocols, categories, and counts from the provided aggregations. Do not invent numbers.
- riskFlags: an array of flag objects, each with "severity" ("info" | "warn" | "high") and "message" (one sentence, max 20 words). Use "info" for neutral observations, "warn" for unusual patterns (e.g. many failed-looking method IDs, high concentration to one counterparty), "high" for clear red flags (known scam contracts, draining patterns). Return [] when nothing stands out.

Rules:
- Base everything on the provided data. Do not invent tx counts, protocol names, or counterparty addresses.
- If the data is thin (few txs, few classifications), say so in the narrative and keep strategyTags short.
- Return ONLY a single JSON object with exactly these three keys (strategyTags, narrative, riskFlags). No prose, no code fences, no markdown.`;

function formatDate(unixSeconds: number): string {
	if (!unixSeconds) return "unknown";
	return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function buildUserPrompt(
	selfAddress: string,
	agg: Aggregations,
	samples: SampleTx[],
): string {
	return `Wallet: ${selfAddress}
Total transactions ingested: ${agg.totalTxs}
Successfully classified: ${agg.classifiedTxs}
Date range: ${formatDate(agg.firstSeen)} to ${formatDate(agg.lastSeen)}

Category counts:
${JSON.stringify(agg.categoryCounts, null, 2)}

Top protocols (from classified txs, up to 5):
${JSON.stringify(agg.topProtocols, null, 2)}

Top counterparties (up to 5):
${JSON.stringify(agg.topCounterparties, null, 2)}

Recent classified transactions (sample, up to 20):
${JSON.stringify(samples, null, 2)}

Return ONLY the JSON object { strategyTags, narrative, riskFlags }.`;
}

function stripFences(raw: string): string {
	return raw
		.replace(/^\s*```(?:json)?\s*/i, "")
		.replace(/\s*```\s*$/i, "")
		.trim();
}

function extractJsonObject(raw: string): string {
	const stripped = stripFences(raw);
	const start = stripped.indexOf("{");
	const end = stripped.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) return stripped;
	return stripped.slice(start, end + 1);
}

function normalize(raw: unknown): SummaryOutput | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const obj = raw as Record<string, unknown>;

	const tagsRaw = Array.isArray(obj.strategyTags) ? obj.strategyTags : [];
	const strategyTags: string[] = [];
	for (const t of tagsRaw) {
		if (typeof t === "string" && t.trim().length > 0) strategyTags.push(t.trim());
	}

	const narrative = typeof obj.narrative === "string" ? obj.narrative : "";

	const flagsRaw = Array.isArray(obj.riskFlags) ? obj.riskFlags : [];
	const riskFlags: RiskFlag[] = [];
	for (const f of flagsRaw) {
		if (!f || typeof f !== "object") continue;
		const fo = f as Record<string, unknown>;
		const sev =
			typeof fo.severity === "string" &&
			(VALID_SEVERITIES as readonly string[]).includes(fo.severity)
				? (fo.severity as RiskFlag["severity"])
				: "info";
		const msg = typeof fo.message === "string" ? fo.message : "";
		if (msg.length === 0) continue;
		riskFlags.push({ severity: sev, message: msg });
	}

	if (narrative.length === 0) return null;
	return { strategyTags, narrative, riskFlags };
}

async function callLlama(
	creds: AiCreds,
	userPrompt: string,
	strictReminder: boolean,
): Promise<string> {
	const userContent = strictReminder
		? `${userPrompt}\n\nReturn ONLY raw JSON for the object { strategyTags, narrative, riskFlags } — no code fences, no commentary.`
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
					{ role: "system", content: SUMMARIZATION_SYSTEM_PROMPT },
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

export async function summarizeDossier(
	creds: AiCreds,
	selfAddress: string,
	aggregations: Aggregations,
	samples: SampleTx[],
): Promise<SummaryOutput | null> {
	const userPrompt = buildUserPrompt(selfAddress, aggregations, samples);
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const raw = await callLlama(creds, userPrompt, attempt > 0);
			const jsonText = extractJsonObject(raw);
			const parsed = JSON.parse(jsonText);
			const normalized = normalize(parsed);
			if (normalized) return normalized;
		} catch {
			// retry or fall through to null
		}
	}
	return null;
}
