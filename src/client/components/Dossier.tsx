import { useEffect, useState } from "react";
import { useAgent } from "agents/react";
import {
	RefreshCw,
	Activity,
	Layers,
	Clock,
	AlertTriangle,
	ArrowUpRight,
	ArrowDownRight,
	ChevronRight,
	Wallet,
} from "lucide-react";
import type {
	WalletAgent,
	WalletState,
	TransactionRow,
	Classification,
} from "../../walletAgent";
import { Sparkline } from "./Sparkline";

type AgentLike = {
	stub: {
		refresh: () => Promise<unknown>;
		getRecentActivity: (limit: number) => Promise<TransactionRow[]>;
	};
};

export function Dossier({
	agent,
	selected,
}: {
	agent: unknown;
	selected: string | null;
}) {
	if (!selected) {
		return (
			<section className="glass flex h-full min-h-0 flex-col items-center justify-center rounded-2xl text-sm text-mute">
				<div className="grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand-strong">
					<Wallet className="h-6 w-6" strokeWidth={1.8} />
				</div>
				<p className="mt-3 font-medium text-ink">No wallet selected</p>
				<p className="mt-1 text-xs">Pick one from the watchlist to begin.</p>
			</section>
		);
	}
	return <DossierPanel key={selected} parentAgent={agent} address={selected} />;
}

function relativeTime(ms: number): string {
	if (!ms) return "never";
	const diff = Date.now() - ms;
	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return `${Math.floor(diff / 86_400_000)}d ago`;
}

const CATEGORY_PALETTE: Record<string, string> = {
	swap: "#f59e0b",
	lp: "#fb923c",
	lending: "#f97316",
	transfer: "#a78bfa",
	bridge: "#38bdf8",
	governance: "#34d399",
	airdrop: "#facc15",
	mint: "#fb7185",
	other: "#9ca3af",
};

function DossierPanel({
	parentAgent,
	address,
}: {
	parentAgent: unknown;
	address: string;
}) {
	const walletAgent = useAgent<WalletAgent, WalletState>({
		agent: "wallet-agent",
		name: address,
	});

	const state = walletAgent.state;
	const dossier = state?.dossier;
	const hasDossier = !!(dossier && dossier.version > 0);

	const [tab, setTab] = useState<"overview" | "activity" | "risk">("overview");
	const [recent, setRecent] = useState<TransactionRow[]>([]);

	useEffect(() => {
		const stub = (walletAgent as unknown as AgentLike).stub;
		let cancelled = false;
		stub
			.getRecentActivity(20)
			.then((rows) => {
				if (!cancelled) setRecent(rows);
			})
			.catch(() => {
				if (!cancelled) setRecent([]);
			});
		return () => {
			cancelled = true;
		};
	}, [walletAgent, state?.txCount, state?.updatedAt]);

	const onRefresh = async () => {
		await (walletAgent as unknown as AgentLike).stub.refresh();
	};

	return (
		<section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
			<StatRow
				txCount={state?.txCount ?? 0}
				lastSyncedBlock={state?.lastSyncedBlock ?? 0}
				updatedAt={state?.updatedAt ?? 0}
				riskCount={dossier?.riskFlags.length ?? 0}
				seed={address}
			/>

			<HeroCard
				address={address}
				txCount={state?.txCount ?? 0}
				updatedAt={state?.updatedAt ?? 0}
				dossier={dossier}
				hasDossier={hasDossier}
				tab={tab}
				onTabChange={setTab}
				onRefresh={onRefresh}
			/>

			<LatestActivitiesCard rows={recent} />
		</section>
	);
}

function StatRow({
	txCount,
	lastSyncedBlock,
	updatedAt,
	riskCount,
	seed,
}: {
	txCount: number;
	lastSyncedBlock: number;
	updatedAt: number;
	riskCount: number;
	seed: string;
}) {
	const cards = [
		{
			label: "Transactions",
			ticker: "TXS",
			value: txCount.toLocaleString(),
			delta: "+0.0%",
			deltaUp: true,
			icon: Activity,
			tint: "bg-amber-100 text-amber-700",
			color: "#f59e0b",
		},
		{
			label: "Synced block",
			ticker: "BLK",
			value: lastSyncedBlock ? lastSyncedBlock.toLocaleString() : "—",
			delta: "live",
			deltaUp: true,
			icon: Layers,
			tint: "bg-sky-100 text-sky-700",
			color: "#0ea5e9",
		},
		{
			label: "Last sync",
			ticker: "SYNC",
			value: relativeTime(updatedAt),
			delta: "auto",
			deltaUp: true,
			icon: Clock,
			tint: "bg-emerald-100 text-emerald-700",
			color: "#10b981",
		},
		{
			label: "Risk flags",
			ticker: "RISK",
			value: String(riskCount),
			delta: riskCount > 0 ? "warn" : "clean",
			deltaUp: riskCount === 0,
			icon: AlertTriangle,
			tint:
				riskCount > 0
					? "bg-rose-100 text-rose-700"
					: "bg-violet-100 text-violet-700",
			color: riskCount > 0 ? "#ef4444" : "#a78bfa",
		},
	];
	return (
		<div className="grid grid-cols-4 gap-3">
			{cards.map((c, i) => (
				<div
					key={c.label}
					className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.45)]"
				>
					{/* flat figma-style diagonal gradient — color saturates upper
					    band, fades through mid, dies into near-canvas at bottom */}
					<div
						className="absolute inset-0"
						style={{
							background: `linear-gradient(160deg, ${c.color}99 0%, ${c.color}55 38%, ${c.color}1a 80%, transparent 100%)`,
						}}
					/>
					{/* subtle bottom darken for depth */}
					<div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
					{/* hairline top highlight, faint */}
					<div className="absolute inset-x-0 top-0 h-px bg-white/10" />
					{/* content */}
					<div className="relative z-10">
						<div className="flex items-start justify-between px-4 pt-3.5">
							<div className="flex items-center gap-2.5">
								<span
									className={`grid h-9 w-9 place-items-center rounded-full ${c.tint}`}
								>
									<c.icon className="h-4 w-4" strokeWidth={2.2} />
								</span>
								<div className="leading-tight">
									<p className="text-xs font-bold text-ink">{c.ticker}</p>
									<p className="text-[10px] text-mute">{c.label}</p>
								</div>
							</div>
							<p
								className={`flex items-center gap-0.5 text-[10px] font-semibold ${
									c.deltaUp ? "text-up" : "text-down"
								}`}
							>
								{c.delta}
								{c.deltaUp ? (
									<ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
								) : (
									<ArrowDownRight className="h-3 w-3" strokeWidth={2.5} />
								)}
							</p>
						</div>
						<p className="mt-1 px-4 text-2xl font-bold tabular-nums text-ink">
							{c.value}
						</p>
						<Sparkline
							seed={`${seed}-${i}`}
							color={c.color}
							gradientId={`spark-${i}`}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

function HeroCard({
	address,
	txCount,
	updatedAt,
	dossier,
	hasDossier,
	tab,
	onTabChange,
	onRefresh,
}: {
	address: string;
	txCount: number;
	updatedAt: number;
	dossier: WalletState["dossier"] | undefined;
	hasDossier: boolean;
	tab: "overview" | "activity" | "risk";
	onTabChange: (t: "overview" | "activity" | "risk") => void;
	onRefresh: () => Promise<void>;
}) {
	const tabs: { id: "overview" | "activity" | "risk"; label: string }[] = [
		{ id: "overview", label: "Overview" },
		{ id: "activity", label: "Activity" },
		{ id: "risk", label: "Risk" },
	];
	return (
		<div className="glass rounded-2xl">
			<div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-xs text-mute">
						<span>Watchlist</span>
						<ChevronRight className="h-3 w-3 text-mute-2" strokeWidth={2.5} />
						<span className="font-mono text-ink">
							{address.slice(0, 10)}…{address.slice(-6)}
						</span>
					</div>
					<h2
						className="mt-1 truncate font-mono text-base text-ink"
						title={address}
					>
						{address}
					</h2>
					<p className="mt-1 text-xs text-mute">
						<span className="font-semibold text-ink">
							{txCount.toLocaleString()}
						</span>{" "}
						transactions · updated {relativeTime(updatedAt)}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						onClick={onRefresh}
						className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-ink backdrop-blur-md transition hover:border-brand/40 hover:bg-white/15 hover:text-brand-strong"
					>
						<RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
						Refresh
					</button>
				</div>
			</div>

			<nav className="flex items-center gap-1 border-b border-edge px-6">
				{tabs.map((t) => {
					const active = tab === t.id;
					return (
						<button
							key={t.id}
							type="button"
							onClick={() => onTabChange(t.id)}
							className={`relative px-3 py-2.5 text-xs font-semibold transition ${
								active ? "text-brand-strong" : "text-mute hover:text-ink"
							}`}
						>
							{t.label}
							{active ? (
								<span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand" />
							) : null}
						</button>
					);
				})}
				<div className="ml-auto flex items-center gap-1 py-2">
					<span className="rounded-md bg-canvas px-2 py-0.5 text-[10px] font-semibold text-mute">
						All
					</span>
					<span className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-mute-2">
						7d
					</span>
					<span className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-mute-2">
						30d
					</span>
				</div>
			</nav>

			<div className="px-6 py-5">
				{!hasDossier || !dossier ? (
					<p className="text-sm text-mute">
						No dossier yet — click Refresh to kick off ingestion, or wait for
						the 10-minute scheduled sweep.
					</p>
				) : tab === "overview" ? (
					<div className="space-y-4">
						<CategoryBar
							protocols={dossier.topProtocols}
							totalTxs={txCount}
						/>
						<StrategyTags tags={dossier.strategyTags} />
						<p
							data-testid="dossier-narrative"
							className="text-sm leading-relaxed text-ink-2"
						>
							{dossier.narrative}
						</p>
					</div>
				) : tab === "activity" ? (
					<CounterpartiesList rows={dossier.topCounterparties} />
				) : (
					<RiskFlags flags={dossier.riskFlags} />
				)}
			</div>
		</div>
	);
}

function CategoryBar({
	protocols,
	totalTxs,
}: {
	protocols: { protocol: string; interactionCount: number }[];
	totalTxs: number;
}) {
	if (protocols.length === 0 || totalTxs === 0) return null;
	const top = protocols.slice(0, 6);
	const totalAccounted = top.reduce((s, p) => s + p.interactionCount, 0);
	const others = Math.max(0, totalTxs - totalAccounted);
	const segments = [
		...top.map((p, i) => ({
			label: p.protocol,
			count: p.interactionCount,
			color: Object.values(CATEGORY_PALETTE)[i % 9],
		})),
		...(others > 0
			? [{ label: "Other", count: others, color: CATEGORY_PALETTE.other }]
			: []),
	];
	const total = segments.reduce((s, x) => s + x.count, 0) || 1;
	return (
		<div>
			<div className="mb-2 flex items-center justify-between">
				<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mute-2">
					Protocol breakdown
				</p>
				<p className="text-[11px] text-mute">{totalTxs.toLocaleString()} txs</p>
			</div>
			<div className="flex h-3 w-full overflow-hidden rounded-full bg-canvas">
				{segments.map((s, i) => (
					<span
						key={i}
						style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
						title={`${s.label}: ${s.count}`}
					/>
				))}
			</div>
			<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
				{segments.map((s, i) => (
					<li
						key={i}
						className="flex items-center gap-1.5 text-[11px] text-ink-2"
					>
						<span
							className="h-2 w-2 rounded-full"
							style={{ background: s.color }}
						/>
						<span className="font-medium">{s.label}</span>
						<span className="text-mute">· {s.count}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function StrategyTags({ tags }: { tags: string[] }) {
	return (
		<div data-testid="strategy-card">
			<div className="mb-2 flex items-center justify-between">
				<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mute-2">
					Strategy
				</p>
				<span className="text-[11px] font-medium text-mute">
					{tags.length} {tags.length === 1 ? "tag" : "tags"}
				</span>
			</div>
			{tags.length === 0 ? (
				<p className="text-sm text-mute">No tags yet.</p>
			) : (
				<ul className="flex flex-wrap gap-1.5">
					{tags.map((t) => (
						<li
							key={t}
							className="rounded-full border border-brand/30 bg-brand/15 px-3 py-1 text-xs font-semibold text-brand-strong backdrop-blur-md"
						>
							{t}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function CounterpartiesList({
	rows,
}: {
	rows: { address: string; label?: string; count: number }[];
}) {
	if (rows.length === 0) {
		return <p className="text-sm text-mute">No counterparty data yet.</p>;
	}
	return (
		<ul className="divide-y divide-edge-soft">
			{rows.map((r) => (
				<li
					key={r.address}
					className="flex items-center justify-between gap-3 py-2.5"
				>
					<div className="min-w-0">
						<p className="truncate text-sm font-semibold text-ink">
							{r.label || `${r.address.slice(0, 10)}…${r.address.slice(-4)}`}
						</p>
						<p className="truncate font-mono text-[11px] text-mute">
							{r.address}
						</p>
					</div>
					<span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-2">
						{r.count} txs
					</span>
				</li>
			))}
		</ul>
	);
}

function RiskFlags({
	flags,
}: {
	flags: { severity: "info" | "warn" | "high"; message: string }[];
}) {
	if (flags.length === 0) {
		return <p className="text-sm text-mute">No risk flags.</p>;
	}
	return (
		<ul className="space-y-1.5">
			{flags.map((f, i) => (
				<li
					key={i}
					className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
						f.severity === "high"
							? "border-rose-200 bg-rose-50 text-rose-800"
							: f.severity === "warn"
								? "border-amber-200 bg-amber-50 text-amber-800"
								: "border-edge bg-surface-2 text-ink-2"
					}`}
				>
					<span className="mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
						{f.severity}
					</span>
					<span className="leading-relaxed">{f.message}</span>
				</li>
			))}
		</ul>
	);
}

function LatestActivitiesCard({ rows }: { rows: TransactionRow[] }) {
	const [filter, setFilter] = useState<string>("all");
	const categories = ["all", "swap", "lp", "lending", "transfer", "bridge", "mint", "other"];
	const filtered = rows.filter((r) => {
		if (filter === "all") return true;
		if (!r.classification) return filter === "other";
		try {
			const cls = JSON.parse(r.classification) as Classification;
			return cls.category === filter;
		} catch {
			return filter === "other";
		}
	});
	return (
		<div className="glass rounded-2xl">
			<div className="flex items-center justify-between border-b border-edge px-6 py-3.5">
				<h3 className="text-sm font-bold text-ink">Latest Activities</h3>
				<span className="text-[11px] text-mute">{rows.length} loaded</span>
			</div>
			<nav className="flex items-center gap-1 overflow-x-auto border-b border-edge px-4 py-1.5">
				{categories.map((c) => {
					const active = filter === c;
					return (
						<button
							key={c}
							type="button"
							onClick={() => setFilter(c)}
							className={`relative px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
								active ? "text-brand-strong" : "text-mute hover:text-ink"
							}`}
						>
							{c}
							{active ? (
								<span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand" />
							) : null}
						</button>
					);
				})}
			</nav>
			{filtered.length === 0 ? (
				<p className="px-6 py-4 text-sm text-mute">
					{rows.length === 0
						? "No activity yet — refresh to ingest."
						: "No transactions in this category."}
				</p>
			) : (
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-edge-soft text-[10px] font-semibold uppercase tracking-[0.16em] text-mute-2">
							<th className="px-6 py-2 text-left">Date</th>
							<th className="px-6 py-2 text-left">Detail</th>
							<th className="px-6 py-2 text-right">Value</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-edge-soft">
						{filtered.slice(0, 8).map((r) => {
							let cls: Classification | null = null;
							try {
								cls = r.classification
									? (JSON.parse(r.classification) as Classification)
									: null;
							} catch {}
							const date = new Date(r.timestamp * 1000);
							const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
							let valueEth = "0";
							try {
								valueEth = (Number(BigInt(r.value_wei)) / 1e18).toFixed(4);
							} catch {}
							return (
								<tr key={r.hash}>
									<td className="px-6 py-3 font-mono text-xs text-mute">
										{dateStr}
									</td>
									<td className="px-6 py-3">
										<div className="flex items-center gap-2">
											{cls?.category ? (
												<span
													className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
													style={{
														background:
															CATEGORY_PALETTE[cls.category] ?? "#9ca3af",
													}}
												>
													{cls.category}
												</span>
											) : null}
											<span className="text-sm text-ink">
												{cls?.notes ||
													(cls?.protocol
														? `Interact with ${cls.protocol}`
														: r.method_id
															? `Method ${r.method_id}`
															: "Transfer")}
											</span>
										</div>
									</td>
									<td className="px-6 py-3 text-right text-sm font-semibold tabular-nums text-ink">
										{valueEth} ETH
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</div>
	);
}
