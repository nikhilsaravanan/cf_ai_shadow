import { env, runInDurableObject } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { WalletAgent } from "../src/walletAgent";

const VITALIK = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";

describe("WalletAgent skeleton", () => {
	it("initializes, stores a lowercased address, and returns the empty fixture dossier", async () => {
		const id = env.WalletAgent.idFromName(VITALIK);
		const stub = env.WalletAgent.get(id);

		const dossier = await runInDurableObject(stub, async (agent: WalletAgent) => {
			await agent.setName(VITALIK);
			return agent.initialize(VITALIK.toUpperCase());
		});

		expect(dossier.address).toBe(VITALIK);
		expect(dossier.version).toBe(0);
		expect(dossier.strategyTags).toEqual([]);
		expect(dossier.riskFlags).toEqual([]);
		expect(dossier.topProtocols).toEqual([]);
		expect(dossier.topCounterparties).toEqual([]);
		expect(dossier.narrative).toMatch(/No activity ingested yet/i);
	});

	it("exposes getDossier and empty recent-activity / tx lookup before ingestion", async () => {
		const id = env.WalletAgent.idFromName(VITALIK);
		const stub = env.WalletAgent.get(id);

		await runInDurableObject(stub, async (agent: WalletAgent) => {
			await agent.setName(VITALIK);
			await agent.initialize(VITALIK);

			const dossier = await agent.getDossier();
			expect(dossier.address).toBe(VITALIK);

			const recent = await agent.getRecentActivity(10);
			expect(recent).toEqual([]);

			const tx = await agent.getTxByHash("0xnope");
			expect(tx).toBeUndefined();
		});
	});

	it("refresh() without initialize throws", async () => {
		const id = env.WalletAgent.idFromName("uninitialized");
		const stub = env.WalletAgent.get(id);

		await runInDurableObject(stub, async (agent: WalletAgent) => {
			await agent.setName("uninitialized");
			await expect(agent.refresh()).rejects.toThrow(/not initialized/i);
		});
	});
});
