import { decodeFunctionData, type Abi } from "viem";

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const NO_ABI_SENTINEL = "null";

export type DecodedTx = {
	methodId: string | null;
	decodedInput: string | null;
};

async function fetchAbi(
	address: string,
	etherscanKey: string,
	cache: KVNamespace,
): Promise<Abi | null> {
	const cacheKey = `abi:${address.toLowerCase()}`;
	const cached = await cache.get(cacheKey);
	if (cached !== null) {
		if (cached === NO_ABI_SENTINEL) return null;
		try {
			return JSON.parse(cached) as Abi;
		} catch {
			return null;
		}
	}
	const url = `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${etherscanKey}`;
	const res = await fetch(url);
	if (!res.ok) return null;
	const json = (await res.json()) as { status: string; message: string; result: string };
	if (json.status !== "1") {
		await cache.put(cacheKey, NO_ABI_SENTINEL, { expirationTtl: CACHE_TTL_SECONDS });
		return null;
	}
	try {
		const abi = JSON.parse(json.result) as Abi;
		await cache.put(cacheKey, JSON.stringify(abi), { expirationTtl: CACHE_TTL_SECONDS });
		return abi;
	} catch {
		await cache.put(cacheKey, NO_ABI_SENTINEL, { expirationTtl: CACHE_TTL_SECONDS });
		return null;
	}
}

export async function decodeTx(
	input: string,
	toAddress: string | null,
	etherscanKey: string,
	cache: KVNamespace,
): Promise<DecodedTx> {
	if (!input || input === "0x" || input.length < 10) {
		return { methodId: null, decodedInput: null };
	}
	const methodId = input.slice(0, 10).toLowerCase();
	if (!toAddress) return { methodId, decodedInput: null };

	const abi = await fetchAbi(toAddress, etherscanKey, cache);
	if (!abi) return { methodId, decodedInput: null };

	try {
		const decoded = decodeFunctionData({ abi, data: input as `0x${string}` });
		const serialized = JSON.stringify(decoded, (_, v) =>
			typeof v === "bigint" ? v.toString(10) : v,
		);
		return { methodId, decodedInput: serialized };
	} catch {
		return { methodId, decodedInput: null };
	}
}
