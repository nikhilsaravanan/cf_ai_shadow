import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { fetchWalletTxs, type RawTx } from "./fetchTxs";
import { decodeTx } from "./decodeTxs";
import { classifyTxs, type TxToClassify } from "./classifyTxs";
import {
	aggregateClassified,
	sampleForSummary,
	summarizeDossier,
	type ClassifiedTx,
	type SummaryOutput,
	type Aggregations,
} from "./summarizeDossier";

export type IngestParams = { address: string };

type DecodedTx = RawTx & { methodId: string | null; decodedInput: string | null };

export type PersistPayload = {
	address: string;
	txs: ClassifiedTx[];
	summary: SummaryOutput | null;
	aggregations: Aggregations;
	highestBlock: number;
};

export class IngestWorkflow extends WorkflowEntrypoint<Env, IngestParams> {
	async run(event: WorkflowEvent<IngestParams>, step: WorkflowStep) {
		const address = event.payload.address.toLowerCase();

		const rawTxs = await step.do("fetch-txs", async () => {
			return fetchWalletTxs(this.env.ALCHEMY_API_KEY, address);
		});

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

		const classified = await step.do("classify", async () => {
			if (decoded.length === 0) return [] as ClassifiedTx[];
			const toClassify: TxToClassify[] = decoded.map((d) => ({
				to: d.to,
				from: d.from,
				valueWei: d.valueWei,
				methodId: d.methodId,
				decodedInput: d.decodedInput,
			}));
			const creds = {
				accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
				apiToken: this.env.WORKERS_AI_API_TOKEN,
			};
			const classifications = await classifyTxs(creds, address, toClassify);
			return decoded.map((d, i) => ({
				hash: d.hash,
				blockNumber: d.blockNumber,
				timestamp: d.timestamp,
				from: d.from,
				to: d.to,
				valueWei: d.valueWei,
				methodId: d.methodId,
				decodedInput: d.decodedInput,
				classification: classifications[i] ?? null,
			})) as ClassifiedTx[];
		});

		const summaryBundle = await step.do("summarize", async () => {
			const aggregations = aggregateClassified(address, classified);
			if (aggregations.totalTxs === 0) return { aggregations, summary: null };
			const samples = sampleForSummary(address, classified, 20);
			const creds = {
				accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
				apiToken: this.env.WORKERS_AI_API_TOKEN,
			};
			const summary = await summarizeDossier(creds, address, aggregations, samples);
			return { aggregations, summary };
		});

		const highestBlock = classified.reduce(
			(max, t) => (t.blockNumber > max ? t.blockNumber : max),
			0,
		);

		await step.do("persist", async () => {
			const id = this.env.WalletAgent.idFromName(address);
			const stub = this.env.WalletAgent.get(id);
			// Workaround for partyserver name-not-set on direct DO-to-DO RPC
			// (https://github.com/cloudflare/workerd/issues/2240). Without this,
			// applyDossier's setState throws when it tries to read .name during emit.
			await stub.setName(address);
			const payload: PersistPayload = {
				address,
				txs: classified,
				summary: summaryBundle.summary,
				aggregations: summaryBundle.aggregations,
				highestBlock,
			};
			await stub.applyDossier(payload);
			return { ok: true };
		});

		return {
			address,
			ingested: rawTxs.length,
			classified: classified.filter((t) => t.classification !== null).length,
			highestBlock,
			dossierVersion: summaryBundle.summary ? "bumped" : "unchanged",
		};
	}
}
