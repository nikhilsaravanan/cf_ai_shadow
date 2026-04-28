import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { fetchWalletTxs, type RawTx } from "./fetchTxs";
import { decodeTx } from "./decodeTxs";
import { classifyTxs, type TxToClassify } from "./classifyTxs";
import {
	summarizeDossier,
	type ClassifiedTx,
	type SummaryOutput,
} from "./summarizeDossier";
import type { Classification } from "../walletAgent";

export type IngestParams = { address: string; fromBlock?: number };

type DecodedTx = RawTx & { methodId: string | null; decodedInput: string | null };

export class IngestWorkflow extends WorkflowEntrypoint<Env, IngestParams> {
	async run(event: WorkflowEvent<IngestParams>, step: WorkflowStep) {
		const address = event.payload.address.toLowerCase();
		const fromBlock = event.payload.fromBlock ?? 0;

		const rawTxs = await step.do("fetch-txs", async () => {
			return fetchWalletTxs(this.env.ALCHEMY_API_KEY, address, fromBlock);
		});

		if (rawTxs.length === 0) {
			console.log(
				`[ingest:${address}] no new txs since block ${fromBlock} — skipping`,
			);
			return {
				address,
				ingested: 0,
				classified: 0,
				newlyClassified: 0,
				highestBlock: fromBlock,
				dossierVersion: "unchanged" as const,
			};
		}

		const decoded = await step.do("decode", async () => {
			const out: DecodedTx[] = [];
			for (const tx of rawTxs) {
				const d = await decodeTx(
					tx.input,
					tx.to,
					this.env.ETHERSCAN_API_KEY,
					this.env.ABI_CACHE,
				);
				out.push({ ...tx, methodId: d.methodId, decodedInput: d.decodedInput });
			}
			return out;
		});

		const cached: Record<string, Classification> = (await step.do(
			"fetch-cached-classifications",
			async () => {
				const id = this.env.WalletAgent.idFromName(address);
				const stub = this.env.WalletAgent.get(id);
				await stub.setName(address);
				const result = await stub.getCachedClassifications(
					decoded.map((d) => d.hash),
				);
				// Plain-object roundtrip to satisfy WorkflowStep's Serializable
				// constraint (RPC return types come back with a Disposable brand).
				return JSON.parse(JSON.stringify(result));
			},
		)) as Record<string, Classification>;

		const classifyResult = await step.do("classify", async () => {
			const toClassifyIdx: number[] = [];
			const toClassify: TxToClassify[] = [];
			for (let i = 0; i < decoded.length; i++) {
				const d = decoded[i];
				if (cached[d.hash]) continue;
				toClassifyIdx.push(i);
				toClassify.push({
					to: d.to,
					from: d.from,
					valueWei: d.valueWei,
					methodId: d.methodId,
					decodedInput: d.decodedInput,
				});
			}

			let newClassifications: (Classification | null)[] = [];
			if (toClassify.length > 0) {
				console.log(
					`[classify] ${toClassify.length} new txs, ${decoded.length - toClassify.length} reused from cache`,
				);
				const creds = {
					accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
					apiToken: this.env.WORKERS_AI_API_TOKEN,
				};
				newClassifications = await classifyTxs(creds, address, toClassify);
			} else {
				console.log(
					`[classify] all ${decoded.length} reused from cache — skipping LLM`,
				);
			}

			let newIdx = 0;
			let newlyClassified = 0;
			const result: ClassifiedTx[] = [];
			for (let i = 0; i < decoded.length; i++) {
				const d = decoded[i];
				let cls: Classification | null;
				if (cached[d.hash]) {
					cls = cached[d.hash];
				} else {
					cls = newClassifications[newIdx++] ?? null;
					if (cls !== null) newlyClassified++;
				}
				result.push({
					hash: d.hash,
					blockNumber: d.blockNumber,
					timestamp: d.timestamp,
					from: d.from,
					to: d.to,
					valueWei: d.valueWei,
					methodId: d.methodId,
					decodedInput: d.decodedInput,
					classification: cls,
				});
			}
			return { classified: result, newlyClassified };
		});

		const { classified, newlyClassified } = classifyResult;
		const highestBlock = classified.reduce(
			(m, t) => (t.blockNumber > m ? t.blockNumber : m),
			0,
		);
		// allClassified gates whether lastSyncedBlock advances. When AI fails for
		// any tx in the batch, we keep lastSyncedBlock pinned so the next refresh
		// re-fetches the same window and retries — otherwise unclassified rows
		// would orphan in SQL forever once the window scrolls past them.
		const cachedCount = Object.keys(cached).length;
		const allClassified =
			cachedCount + newlyClassified === classified.length;
		if (!allClassified) {
			console.log(
				`[ingest:${address}] partial classification (${cachedCount} cached + ${newlyClassified} new vs ${classified.length} fetched) — pinning lastSyncedBlock for retry`,
			);
		}

		type AggResult = {
			aggregations: import("./summarizeDossier").Aggregations;
			samples: import("./summarizeDossier").SampleTx[];
		};
		const aggResult: AggResult = (await step.do(
			"upsert-and-aggregate",
			async () => {
				const id = this.env.WalletAgent.idFromName(address);
				const stub = this.env.WalletAgent.get(id);
				await stub.setName(address);
				const result = await stub.upsertAndAggregate(
					classified,
					highestBlock,
					allClassified,
				);
				return JSON.parse(JSON.stringify(result));
			},
		)) as AggResult;

		let summary: SummaryOutput | null = null;
		if (newlyClassified > 0) {
			summary = await step.do("summarize", async () => {
				const creds = {
					accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
					apiToken: this.env.WORKERS_AI_API_TOKEN,
				};
				return await summarizeDossier(
					creds,
					address,
					aggResult.aggregations,
					aggResult.samples,
				);
			});
		} else {
			console.log(
				`[summarize] 0 newly classified — skipping LLM, dossier narrative unchanged`,
			);
		}

		if (summary) {
			await step.do("apply-summary", async () => {
				const id = this.env.WalletAgent.idFromName(address);
				const stub = this.env.WalletAgent.get(id);
				await stub.setName(address);
				await stub.applySummary(summary as SummaryOutput);
				return { ok: true };
			});
		}

		return {
			address,
			ingested: rawTxs.length,
			classified: classified.filter((t) => t.classification !== null).length,
			newlyClassified,
			highestBlock,
			dossierVersion: summary ? "bumped" : "unchanged",
		};
	}
}
