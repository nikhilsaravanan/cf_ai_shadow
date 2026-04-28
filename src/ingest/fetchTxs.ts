const ALCHEMY_URL = (key: string) => `https://eth-mainnet.g.alchemy.com/v2/${key}`;
const MAX_TXS = 200;
// Incremental refreshes cap fetched txs lower so a hot wallet's catch-up burst
// after a quota outage doesn't try to classify 200 txs in one cycle.
const MAX_TXS_INCREMENTAL = 50;
const CATEGORIES = ["external", "erc20", "erc721", "erc1155", "internal"];

type AlchemyTransfer = {
	hash: string;
	blockNum: string;
	from: string;
	to: string | null;
	metadata: { blockTimestamp: string };
};

type RawTxRpc = {
	hash: string;
	blockNumber: string;
	from: string;
	to: string | null;
	value: string;
	input: string;
};

export type RawTx = {
	hash: string;
	blockNumber: number;
	timestamp: number;
	from: string;
	to: string | null;
	valueWei: string;
	input: string;
};

async function rpc<T>(url: string, method: string, params: unknown, canRetry = true): Promise<T> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	if (res.status === 429 && canRetry) {
		await new Promise((r) => setTimeout(r, 1000));
		return rpc<T>(url, method, params, false);
	}
	if (!res.ok) throw new Error(`${method} failed: HTTP ${res.status}`);
	const json = (await res.json()) as { result?: T; error?: { message: string } };
	if (json.error) throw new Error(`${method}: ${json.error.message}`);
	return json.result as T;
}

async function rpcBatch<T>(
	url: string,
	calls: { method: string; params: unknown }[],
	canRetry = true,
): Promise<(T | null)[]> {
	if (calls.length === 0) return [];
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(
			calls.map((c, i) => ({ jsonrpc: "2.0", id: i, method: c.method, params: c.params })),
		),
	});
	if (res.status === 429 && canRetry) {
		await new Promise((r) => setTimeout(r, 1000));
		return rpcBatch<T>(url, calls, false);
	}
	if (!res.ok) throw new Error(`batch failed: HTTP ${res.status}`);
	const json = (await res.json()) as { id: number; result?: T; error?: unknown }[];
	const out: (T | null)[] = new Array(calls.length).fill(null);
	for (const r of json) out[r.id] = r.error ? null : (r.result ?? null);
	return out;
}

export async function fetchWalletTxs(
	apiKey: string,
	address: string,
	fromBlock = 0,
): Promise<RawTx[]> {
	const url = ALCHEMY_URL(apiKey);
	const addr = address.toLowerCase();

	// fromBlock=0 → initial sync, return MOST RECENT 200 (order=desc).
	// fromBlock>0 → incremental, catch up OLDEST UNSYNCED first (order=asc) so a hot
	// wallet with >cap unsynced txs walks forward across multiple refreshes instead
	// of skipping the gap. Cap is lower for incremental to keep per-cycle classify
	// burst bounded.
	const cap = fromBlock > 0 ? MAX_TXS_INCREMENTAL : MAX_TXS;
	const capHex = "0x" + cap.toString(16);
	const baseParams: Record<string, unknown> = {
		category: CATEGORIES,
		withMetadata: true,
		excludeZeroValue: false,
		maxCount: capHex,
		order: fromBlock > 0 ? "asc" : "desc",
	};
	if (fromBlock > 0) {
		baseParams.fromBlock = "0x" + fromBlock.toString(16);
	}

	const [out, inn] = await Promise.all([
		rpc<{ transfers: AlchemyTransfer[] }>(url, "alchemy_getAssetTransfers", [
			{ fromAddress: addr, ...baseParams },
		]),
		rpc<{ transfers: AlchemyTransfer[] }>(url, "alchemy_getAssetTransfers", [
			{ toAddress: addr, ...baseParams },
		]),
	]);

	const byHash = new Map<string, AlchemyTransfer>();
	for (const t of [...out.transfers, ...inn.transfers]) {
		if (!byHash.has(t.hash)) byHash.set(t.hash, t);
	}

	const transfers = Array.from(byHash.values())
		.sort((a, b) =>
			fromBlock > 0
				? parseInt(a.blockNum, 16) - parseInt(b.blockNum, 16)
				: parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16),
		)
		.slice(0, cap);

	if (transfers.length === 0) return [];

	const calls = transfers.map((t) => ({
		method: "eth_getTransactionByHash",
		params: [t.hash],
	}));
	const rawTxs = await rpcBatch<RawTxRpc>(url, calls);

	const rows: RawTx[] = [];
	for (let i = 0; i < transfers.length; i++) {
		const t = transfers[i];
		const raw = rawTxs[i];
		if (!raw) continue;
		rows.push({
			hash: t.hash,
			blockNumber: parseInt(t.blockNum, 16),
			timestamp: Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000),
			from: raw.from.toLowerCase(),
			to: raw.to ? raw.to.toLowerCase() : null,
			valueWei: BigInt(raw.value).toString(10),
			input: raw.input,
		});
	}
	return rows;
}
