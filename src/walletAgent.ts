import { Agent, callable } from "agents";
import { fetchWalletTxs } from "./ingest/fetchTxs";
import { decodeTx } from "./ingest/decodeTxs";
import { classifyTxs, type TxToClassify } from "./ingest/classifyTxs";
import {
	summarizeDossier,
	type Aggregations,
	type SampleTx,
} from "./ingest/summarizeDossier";

export type Classification = {
	category:
		| "swap"
		| "lp"
		| "lending"
		| "transfer"
		| "bridge"
		| "governance"
		| "airdrop"
		| "mint"
		| "other";
	protocol?: string;
	notes: string;
};

export type RiskFlag = {
	severity: "info" | "warn" | "high";
	message: string;
};

export type Dossier = {
	version: number;
	address: string;
	strategyTags: string[];
	narrative: string;
	riskFlags: RiskFlag[];
	topProtocols: { protocol: string; interactionCount: number }[];
	topCounterparties: { address: string; label?: string; count: number }[];
	generatedAt: number;
};

export type WalletState = {
	address: string;
	chain: "ethereum";
	lastSyncedBlock: number;
	dossier: Dossier;
	txCount: number;
	updatedAt: number;
};

export type TransactionRow = {
	hash: string;
	block_number: number;
	timestamp: number;
	from_address: string;
	to_address: string | null;
	value_wei: string;
	method_id: string | null;
	decoded_input: string | null;
	classification: string | null;
};

const emptyDossier = (address: string): Dossier => ({
	version: 0,
	address,
	strategyTags: [],
	narrative: "No activity ingested yet.",
	riskFlags: [],
	topProtocols: [],
	topCounterparties: [],
	generatedAt: 0,
});

export class WalletAgent extends Agent<Env, WalletState> {
	initialState: WalletState = {
		address: "",
		chain: "ethereum",
		lastSyncedBlock: 0,
		dossier: emptyDossier(""),
		txCount: 0,
		updatedAt: 0,
	};

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => this._migrate());
	}

	private _migrate() {
		this.sql`
			CREATE TABLE IF NOT EXISTS transactions (
				hash TEXT PRIMARY KEY,
				block_number INTEGER NOT NULL,
				timestamp INTEGER NOT NULL,
				from_address TEXT NOT NULL,
				to_address TEXT,
				value_wei TEXT NOT NULL,
				method_id TEXT,
				decoded_input TEXT,
				classification TEXT
			)
		`;
		this.sql`
			CREATE TABLE IF NOT EXISTS counterparties (
				address TEXT PRIMARY KEY,
				label TEXT,
				interaction_count INTEGER NOT NULL DEFAULT 0,
				first_seen INTEGER NOT NULL,
				last_seen INTEGER NOT NULL
			)
		`;
	}

	@callable({ description: "Initialize the WalletAgent for a given lowercased address." })
	async initialize(address: string): Promise<Dossier> {
		const addr = address.toLowerCase();
		this.setState({
			...this.state,
			address: addr,
			dossier: { ...this.state.dossier, address: addr },
			updatedAt: Date.now(),
		});
		return this.state.dossier;
	}

	@callable({
		description:
			"Fetch, decode, classify, persist, and summarize recent transactions for this wallet.",
	})
	async refresh(): Promise<{
		ok: true;
		ingested: number;
		classified: number;
		highestBlock: number;
		dossierVersion: number;
	}> {
		const address = this.state.address;
		if (!address) throw new Error("WalletAgent not initialized: call initialize(address) first");

		const rawTxs = await fetchWalletTxs(this.env.ALCHEMY_API_KEY, address);

		const decoded: {
			hash: string;
			blockNumber: number;
			timestamp: number;
			from: string;
			to: string | null;
			valueWei: string;
			methodId: string | null;
			decodedInput: string | null;
		}[] = [];
		for (const tx of rawTxs) {
			const d = await decodeTx(
				tx.input,
				tx.to,
				this.env.ETHERSCAN_API_KEY,
				this.env.ABI_CACHE,
			);
			decoded.push({
				hash: tx.hash,
				blockNumber: tx.blockNumber,
				timestamp: tx.timestamp,
				from: tx.from,
				to: tx.to,
				valueWei: tx.valueWei,
				methodId: d.methodId,
				decodedInput: d.decodedInput,
			});
		}

		const toClassify: TxToClassify[] = decoded.map((d) => ({
			to: d.to,
			from: d.from,
			valueWei: d.valueWei,
			methodId: d.methodId,
			decodedInput: d.decodedInput,
		}));
		const classifications =
			decoded.length > 0
				? await classifyTxs(
						{
							accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
							apiToken: this.env.WORKERS_AI_API_TOKEN,
						},
						address,
						toClassify,
					)
				: [];

		let highestBlock = this.state.lastSyncedBlock;
		let classifiedCount = 0;
		for (let i = 0; i < decoded.length; i++) {
			const tx = decoded[i];
			const cls = classifications[i] ?? null;
			const clsJson = cls ? JSON.stringify(cls) : null;
			if (clsJson) classifiedCount++;
			this.sql`
				INSERT OR REPLACE INTO transactions
					(hash, block_number, timestamp, from_address, to_address,
					 value_wei, method_id, decoded_input, classification)
				VALUES
					(${tx.hash}, ${tx.blockNumber}, ${tx.timestamp}, ${tx.from}, ${tx.to},
					 ${tx.valueWei}, ${tx.methodId}, ${tx.decodedInput}, ${clsJson})
			`;
			if (tx.blockNumber > highestBlock) highestBlock = tx.blockNumber;
		}

		this._recomputeCounterparties(address);

		const [{ c: txCount }] = this.sql<{ c: number }>`SELECT COUNT(*) AS c FROM transactions`;

		const aggregations = this._aggregate();
		const samples = this._sampleForSummary(address, 20);
		const creds = {
			accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
			apiToken: this.env.WORKERS_AI_API_TOKEN,
		};
		const summary =
			aggregations.totalTxs > 0
				? await summarizeDossier(creds, address, aggregations, samples)
				: null;

		const nextDossier: Dossier = summary
			? {
					version: this.state.dossier.version + 1,
					address,
					strategyTags: summary.strategyTags,
					narrative: summary.narrative,
					riskFlags: summary.riskFlags,
					topProtocols: aggregations.topProtocols,
					topCounterparties: aggregations.topCounterparties,
					generatedAt: Date.now(),
				}
			: {
					...this.state.dossier,
					address,
					topProtocols: aggregations.topProtocols,
					topCounterparties: aggregations.topCounterparties,
					generatedAt: Date.now(),
				};

		this.setState({
			...this.state,
			lastSyncedBlock: highestBlock,
			txCount,
			updatedAt: Date.now(),
			dossier: nextDossier,
		});

		return {
			ok: true,
			ingested: rawTxs.length,
			classified: classifiedCount,
			highestBlock,
			dossierVersion: nextDossier.version,
		};
	}

	private _aggregate(): Aggregations {
		const [stats] = this.sql<{
			total: number;
			classified: number;
			first: number | null;
			last: number | null;
		}>`
			SELECT
				COUNT(*) AS total,
				SUM(CASE WHEN classification IS NOT NULL THEN 1 ELSE 0 END) AS classified,
				MIN(timestamp) AS first,
				MAX(timestamp) AS last
			FROM transactions
		`;

		const catRows = this.sql<{ cat: string; c: number }>`
			SELECT json_extract(classification, '$.category') AS cat, COUNT(*) AS c
			FROM transactions
			WHERE classification IS NOT NULL
			GROUP BY cat
		`;
		const categoryCounts: Record<string, number> = {};
		for (const r of catRows) {
			if (r.cat) categoryCounts[r.cat] = r.c;
		}

		const protoRows = this.sql<{ protocol: string; c: number }>`
			SELECT json_extract(classification, '$.protocol') AS protocol, COUNT(*) AS c
			FROM transactions
			WHERE classification IS NOT NULL
			  AND json_extract(classification, '$.protocol') IS NOT NULL
			GROUP BY protocol
			ORDER BY c DESC
			LIMIT 5
		`;
		const topProtocols = Array.from(protoRows).map((r) => ({
			protocol: r.protocol,
			interactionCount: r.c,
		}));

		const cpRows = this.sql<{ address: string; label: string | null; c: number }>`
			SELECT address, label, interaction_count AS c
			FROM counterparties
			ORDER BY interaction_count DESC
			LIMIT 5
		`;
		const topCounterparties = Array.from(cpRows).map((r) => ({
			address: r.address,
			label: r.label ?? undefined,
			count: r.c,
		}));

		return {
			totalTxs: stats?.total ?? 0,
			classifiedTxs: stats?.classified ?? 0,
			firstSeen: stats?.first ?? 0,
			lastSeen: stats?.last ?? 0,
			categoryCounts,
			topProtocols,
			topCounterparties,
		};
	}

	private _sampleForSummary(selfAddress: string, limit: number): SampleTx[] {
		const rows = this.sql<{
			hash: string;
			from_address: string;
			to_address: string | null;
			value_wei: string;
			classification: string | null;
		}>`
			SELECT hash, from_address, to_address, value_wei, classification
			FROM transactions
			WHERE classification IS NOT NULL
			ORDER BY block_number DESC
			LIMIT ${limit}
		`;
		const out: SampleTx[] = [];
		for (const r of rows) {
			let category: string | null = null;
			let protocol: string | null = null;
			let notes: string | null = null;
			if (r.classification) {
				try {
					const parsed = JSON.parse(r.classification) as Classification;
					category = parsed.category;
					protocol = parsed.protocol ?? null;
					notes = parsed.notes ?? null;
				} catch {
					// ignore parse errors
				}
			}
			const outgoing = r.from_address === selfAddress;
			let valueEth = "0";
			try {
				valueEth = (Number(BigInt(r.value_wei)) / 1e18).toFixed(6);
			} catch {
				// keep default
			}
			out.push({
				hash: r.hash,
				direction: outgoing ? "out" : "in",
				counterparty: outgoing ? r.to_address : r.from_address,
				valueEth,
				category,
				protocol,
				notes,
			});
		}
		return out;
	}

	private _recomputeCounterparties(selfAddress: string) {
		this.sql`DELETE FROM counterparties`;
		this.sql`
			INSERT INTO counterparties (address, label, interaction_count, first_seen, last_seen)
			SELECT
				CASE WHEN from_address = ${selfAddress} THEN to_address ELSE from_address END AS address,
				NULL AS label,
				COUNT(*) AS interaction_count,
				MIN(timestamp) * 1000 AS first_seen,
				MAX(timestamp) * 1000 AS last_seen
			FROM transactions
			WHERE (CASE WHEN from_address = ${selfAddress} THEN to_address ELSE from_address END) IS NOT NULL
			GROUP BY address
		`;
	}

	@callable({ description: "Return the current dossier for this wallet." })
	async getDossier(): Promise<Dossier> {
		return this.state.dossier;
	}

	@callable({ description: "Return the most recent classified transactions for this wallet." })
	async getRecentActivity(limit = 20): Promise<TransactionRow[]> {
		const rows = this.sql<TransactionRow>`
			SELECT hash, block_number, timestamp, from_address, to_address,
			       value_wei, method_id, decoded_input, classification
			FROM transactions
			ORDER BY block_number DESC
			LIMIT ${limit}
		`;
		return [...rows];
	}

	@callable({ description: "Look up a single transaction by its hash." })
	async getTxByHash(hash: string): Promise<TransactionRow | undefined> {
		const [row] = this.sql<TransactionRow>`
			SELECT hash, block_number, timestamp, from_address, to_address,
			       value_wei, method_id, decoded_input, classification
			FROM transactions
			WHERE hash = ${hash}
		`;
		return row;
	}
}
