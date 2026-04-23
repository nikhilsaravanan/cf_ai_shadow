import { env, runInDurableObject } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { WalletAgent } from "../src/walletAgent";

const VITALIK = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";

const INTEGRATION = (env as unknown as { INTEGRATION?: string }).INTEGRATION === "1";
const HAS_SECRETS =
	typeof env.ALCHEMY_API_KEY === "string" &&
	env.ALCHEMY_API_KEY.length > 0 &&
	!env.ALCHEMY_API_KEY.startsWith("your_") &&
	typeof env.ETHERSCAN_API_KEY === "string" &&
	env.ETHERSCAN_API_KEY.length > 0 &&
	!env.ETHERSCAN_API_KEY.startsWith("your_");

describe.skipIf(!INTEGRATION || !HAS_SECRETS)("WalletAgent ingestion (live)", () => {
	it("refresh() pulls and persists at least 10 txs for Vitalik", async () => {
		const id = env.WalletAgent.idFromName(VITALIK);
		const stub = env.WalletAgent.get(id);

		const result = await runInDurableObject(stub, async (agent: WalletAgent) => {
			await agent.setName(VITALIK);
			await agent.initialize(VITALIK);
			const refresh = await agent.refresh();
			const recent = await agent.getRecentActivity(25);
			return { refresh, recent };
		});

		expect(result.refresh.ok).toBe(true);
		expect(result.refresh.ingested).toBeGreaterThanOrEqual(10);
		expect(result.recent.length).toBeGreaterThanOrEqual(10);

		const first = result.recent[0];
		expect(first.hash).toMatch(/^0x[0-9a-f]{64}$/);
		expect(first.block_number).toBeGreaterThan(0);
		expect(first.from_address).toMatch(/^0x[0-9a-f]{40}$/);
		expect(first.classification).toBeNull();
	}, 60_000);
});
