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
	!env.ETHERSCAN_API_KEY.startsWith("your_") &&
	typeof env.WORKERS_AI_API_TOKEN === "string" &&
	env.WORKERS_AI_API_TOKEN.length > 0 &&
	!env.WORKERS_AI_API_TOKEN.startsWith("your_");

describe.skipIf(!INTEGRATION || !HAS_SECRETS)("WalletAgent ingestion (live)", () => {
	it("refresh() ingests, classifies, and summarizes Vitalik's wallet", async () => {
		const id = env.WalletAgent.idFromName(VITALIK);
		const stub = env.WalletAgent.get(id);

		const result = await runInDurableObject(stub, async (agent: WalletAgent) => {
			await agent.setName(VITALIK);
			await agent.initialize(VITALIK);
			const refresh = await agent.refresh();
			const recent = await agent.getRecentActivity(50);
			const dossier = await agent.getDossier();
			return { refresh, recent, dossier };
		});

		expect(result.refresh.ok).toBe(true);
		expect(result.refresh.instanceId).toMatch(/\S/);
		expect(result.refresh.txCount).toBeGreaterThanOrEqual(10);
		expect(result.refresh.dossierVersion).toBeGreaterThanOrEqual(1);
		expect(result.recent.length).toBeGreaterThanOrEqual(10);

		const first = result.recent[0];
		expect(first.hash).toMatch(/^0x[0-9a-f]{64}$/);
		expect(first.block_number).toBeGreaterThan(0);
		expect(first.from_address).toMatch(/^0x[0-9a-f]{40}$/);

		const classified = result.recent.filter((t) => t.classification !== null).length;
		expect(classified / result.recent.length).toBeGreaterThanOrEqual(0.8);

		const sample = result.recent.find((t) => t.classification !== null);
		expect(sample).toBeDefined();
		const parsed = JSON.parse(sample!.classification!);
		expect(typeof parsed.category).toBe("string");
		expect(typeof parsed.notes).toBe("string");

		expect(result.dossier.address).toBe(VITALIK);
		expect(result.dossier.version).toBeGreaterThanOrEqual(1);
		expect(result.dossier.strategyTags.length).toBeGreaterThanOrEqual(1);
		expect(result.dossier.narrative.length).toBeGreaterThan(50);
		expect(result.dossier.generatedAt).toBeGreaterThan(0);
		expect(result.dossier.topCounterparties.length).toBeGreaterThan(0);
	}, 180_000);
});
