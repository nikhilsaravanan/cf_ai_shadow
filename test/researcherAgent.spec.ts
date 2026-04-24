import { env, runInDurableObject } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { ResearcherAgent } from "../src/server";

const VITALIK = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
const OTHER = "0x00000000219ab540356cbb839cbe05303d7705fa";

describe("ResearcherAgent watchlist", () => {
	it("addToWatchlist lowercases, dedupes, and persists", async () => {
		const id = env.ResearcherAgent.idFromName("default");
		const stub = env.ResearcherAgent.get(id);

		const watchlist = await runInDurableObject(stub, async (agent: ResearcherAgent) => {
			await agent.setName("default");
			await agent.addToWatchlist(VITALIK.toUpperCase());
			await agent.addToWatchlist(VITALIK); // duplicate
			await agent.addToWatchlist(OTHER, "beacon deposit");
			return agent.getWatchlist();
		});

		expect(watchlist).toHaveLength(2);
		expect(watchlist[0].address).toBe(VITALIK);
		expect(watchlist[0].addedAt).toBeGreaterThan(0);
		expect(watchlist[1].address).toBe(OTHER);
		expect(watchlist[1].label).toBe("beacon deposit");
	});

	it("addToWatchlist rejects malformed addresses", async () => {
		const id = env.ResearcherAgent.idFromName("default-bad");
		const stub = env.ResearcherAgent.get(id);

		await runInDurableObject(stub, async (agent: ResearcherAgent) => {
			await agent.setName("default-bad");
			await expect(agent.addToWatchlist("not-an-address")).rejects.toThrow(/invalid address/);
			await expect(agent.addToWatchlist("0x123")).rejects.toThrow(/invalid address/);
		});
	});

	it("removeFromWatchlist drops the entry, case-insensitive", async () => {
		const id = env.ResearcherAgent.idFromName("default-remove");
		const stub = env.ResearcherAgent.get(id);

		const watchlist = await runInDurableObject(stub, async (agent: ResearcherAgent) => {
			await agent.setName("default-remove");
			await agent.addToWatchlist(VITALIK);
			await agent.addToWatchlist(OTHER);
			await agent.removeFromWatchlist(VITALIK.toUpperCase());
			return agent.getWatchlist();
		});

		expect(watchlist).toHaveLength(1);
		expect(watchlist[0].address).toBe(OTHER);
	});

	it("getDossierFor returns the empty fixture for a fresh wallet", async () => {
		const id = env.ResearcherAgent.idFromName("default-dossier");
		const stub = env.ResearcherAgent.get(id);

		const dossier = await runInDurableObject(stub, async (agent: ResearcherAgent) => {
			await agent.setName("default-dossier");
			return agent.getDossierFor(VITALIK);
		});

		expect(dossier.version).toBe(0);
		expect(dossier.strategyTags).toEqual([]);
		expect(dossier.narrative).toMatch(/No activity ingested yet/i);
	});
});
