import { Agent, callable } from "agents";

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

	@callable({ description: "Manually trigger a refresh of this wallet's dossier. (M2 stub.)" })
	async refresh(): Promise<{ ok: true; stub: true }> {
		return { ok: true, stub: true };
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
