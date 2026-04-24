import { Agent, callable } from "agents";
import type { PersistPayload } from "./ingest/workflow";

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

const WORKFLOW_TIMEOUT_MS = 5 * 60 * 1000;
const WORKFLOW_POLL_MS = 500;

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
			"Trigger the IngestWorkflow for this wallet and await completion. Fetches, classifies, and summarizes recent transactions.",
	})
	async refresh(): Promise<{
		ok: true;
		instanceId: string;
		dossierVersion: number;
		txCount: number;
	}> {
		const address = this.state.address;
		if (!address) throw new Error("WalletAgent not initialized: call initialize(address) first");

		const instance = await this.env.IngestWorkflow.create({ params: { address } });
		const deadline = Date.now() + WORKFLOW_TIMEOUT_MS;
		while (true) {
			const status = await instance.status();
			if (status.status === "complete") break;
			if (status.status === "errored" || status.status === "terminated") {
				throw new Error(`IngestWorkflow ${instance.id} ${status.status}`);
			}
			if (Date.now() > deadline) {
				throw new Error(`IngestWorkflow ${instance.id} timed out`);
			}
			await new Promise((r) => setTimeout(r, WORKFLOW_POLL_MS));
		}

		return {
			ok: true,
			instanceId: instance.id,
			dossierVersion: this.state.dossier.version,
			txCount: this.state.txCount,
		};
	}

	async applyDossier(payload: PersistPayload): Promise<void> {
		const address = payload.address;
		if (address !== this.state.address) {
			throw new Error(
				`applyDossier address mismatch: payload ${address} vs state ${this.state.address}`,
			);
		}

		for (const tx of payload.txs) {
			const clsJson = tx.classification ? JSON.stringify(tx.classification) : null;
			this.sql`
				INSERT OR REPLACE INTO transactions
					(hash, block_number, timestamp, from_address, to_address,
					 value_wei, method_id, decoded_input, classification)
				VALUES
					(${tx.hash}, ${tx.blockNumber}, ${tx.timestamp}, ${tx.from}, ${tx.to},
					 ${tx.valueWei}, ${tx.methodId}, ${tx.decodedInput}, ${clsJson})
			`;
		}

		this._recomputeCounterparties(address);

		const [{ c: txCount }] = this.sql<{ c: number }>`SELECT COUNT(*) AS c FROM transactions`;

		const summary = payload.summary;
		const nextDossier: Dossier = summary
			? {
					version: this.state.dossier.version + 1,
					address,
					strategyTags: summary.strategyTags,
					narrative: summary.narrative,
					riskFlags: summary.riskFlags,
					topProtocols: payload.aggregations.topProtocols,
					topCounterparties: payload.aggregations.topCounterparties,
					generatedAt: Date.now(),
				}
			: {
					...this.state.dossier,
					address,
					topProtocols: payload.aggregations.topProtocols,
					topCounterparties: payload.aggregations.topCounterparties,
					generatedAt: Date.now(),
				};

		const highestBlock = Math.max(this.state.lastSyncedBlock, payload.highestBlock);

		this.setState({
			...this.state,
			lastSyncedBlock: highestBlock,
			txCount,
			updatedAt: Date.now(),
			dossier: nextDossier,
		});
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
