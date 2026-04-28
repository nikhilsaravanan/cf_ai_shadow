import { useAgent } from "agents/react";
import {
	RefreshCw,
	Activity,
	Layers,
	Clock,
	AlertTriangle,
	ArrowUpRight,
	ChevronRight,
	Wallet,
} from "lucide-react";
import type { WalletAgent, WalletState } from "../../walletAgent";

type AgentLike = { stub: { refresh: () => Promise<unknown> } };

export function Dossier({
	agent,
	selected,
}: {
	agent: unknown;
	selected: string | null;
}) {
	if (!selected) {
		return (
			<section className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-edge bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)] text-sm text-mute">
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

const PROTO_PALETTE = [
	"bg-amber-100 text-amber-700",
	"bg-orange-100 text-orange-700",
	"bg-rose-100 text-rose-700",
	"bg-violet-100 text-violet-700",
	"bg-sky-100 text-sky-700",
	"bg-emerald-100 text-emerald-700",
];

function chipFor(seed: string): { className: string; letter: string } {
	let hash = 0;
	for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
	return {
		letter: (seed.charAt(0) || "?").toUpperCase(),
		className: PROTO_PALETTE[Math.abs(hash) % PROTO_PALETTE.length],
	};
}

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

	const onRefresh = async () => {
		await (walletAgent as unknown as AgentLike).stub.refresh();
	};

	return (
		<section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
			<Breadcrumb address={address} />

			<StatRow
				txCount={state?.txCount ?? 0}
				lastSyncedBlock={state?.lastSyncedBlock ?? 0}
				updatedAt={state?.updatedAt ?? 0}
				riskCount={dossier?.riskFlags.length ?? 0}
			/>

			<HeroCard
				address={address}
				txCount={state?.txCount ?? 0}
				updatedAt={state?.updatedAt ?? 0}
				dossier={dossier}
				hasDossier={hasDossier}
				onRefresh={onRefresh}
			/>

			<div className="grid grid-cols-2 gap-4">
				<ProtocolsCard rows={dossier?.topProtocols ?? []} />
				<CounterpartiesCard rows={dossier?.topCounterparties ?? []} />
			</div>
		</section>
	);
}

function Breadcrumb({ address }: { address: string }) {
	return (
		<nav className="flex items-center gap-1.5 text-xs text-mute">
			<span>Watchlist</span>
			<ChevronRight className="h-3 w-3 text-mute-2" strokeWidth={2.5} />
			<span className="font-mono text-ink">
				{address.slice(0, 10)}…{address.slice(-6)}
			</span>
		</nav>
	);
}

function HeroCard({
	address,
	txCount,
	updatedAt,
	dossier,
	hasDossier,
	onRefresh,
}: {
	address: string;
	txCount: number;
	updatedAt: number;
	dossier: { strategyTags: string[]; narrative: string; riskFlags: { severity: "info" | "warn" | "high"; message: string }[] } | undefined;
	hasDossier: boolean;
	onRefresh: () => Promise<void>;
}) {
	return (
		<div className="rounded-2xl border border-edge bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
			<div className="flex items-start justify-between gap-4 border-b border-edge px-6 py-4">
				<div className="min-w-0">
					<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mute-2">
						Wallet
					</p>
					<h2
						className="mt-1 truncate font-mono text-sm text-ink"
						title={address}
					>
						{address}
					</h2>
					<p className="mt-1 text-xs text-mute">
						{txCount.toLocaleString()} txs · updated {relativeTime(updatedAt)}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<div className="flex gap-0.5 rounded-lg border border-edge bg-surface-2 p-0.5 text-[11px] font-semibold">
						<span className="rounded-md bg-gradient-to-r from-brand to-brand-2 px-2.5 py-1 text-white">
							All
						</span>
						<span className="px-2.5 py-1 text-mute">7d</span>
						<span className="px-2.5 py-1 text-mute">30d</span>
					</div>
					<button
						type="button"
						onClick={onRefresh}
						className="flex items-center gap-1.5 rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand-strong"
					>
						<RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
						Refresh
					</button>
				</div>
			</div>

			<div className="space-y-4 px-6 py-5">
				{hasDossier && dossier ? (
					<>
						<StrategyTags tags={dossier.strategyTags} />
						<p
							data-testid="dossier-narrative"
							className="text-sm leading-relaxed text-ink-2"
						>
							{dossier.narrative}
						</p>
						{dossier.riskFlags.length > 0 ? (
							<RiskFlags flags={dossier.riskFlags} />
						) : null}
					</>
				) : (
					<p className="text-sm text-mute">
						No dossier yet — click Refresh to kick off ingestion, or wait for
						the 10-minute scheduled sweep.
					</p>
				)}
			</div>
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
							className="rounded-full bg-gradient-to-r from-brand/15 to-brand-2/15 px-3 py-1 text-xs font-semibold text-brand-strong ring-1 ring-brand/25"
						>
							{t}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function StatRow({
	txCount,
	lastSyncedBlock,
	updatedAt,
	riskCount,
}: {
	txCount: number;
	lastSyncedBlock: number;
	updatedAt: number;
	riskCount: number;
}) {
	const cards = [
		{
			label: "Transactions",
			value: txCount.toLocaleString(),
			icon: Activity,
			tint: "bg-amber-100 text-amber-700",
		},
		{
			label: "Synced block",
			value: lastSyncedBlock ? lastSyncedBlock.toLocaleString() : "—",
			icon: Layers,
			tint: "bg-sky-100 text-sky-700",
		},
		{
			label: "Last sync",
			value: relativeTime(updatedAt),
			icon: Clock,
			tint: "bg-emerald-100 text-emerald-700",
		},
		{
			label: "Risk flags",
			value: String(riskCount),
			icon: AlertTriangle,
			tint:
				riskCount > 0
					? "bg-rose-100 text-rose-700"
					: "bg-violet-100 text-violet-700",
		},
	];
	return (
		<div className="grid grid-cols-4 gap-3">
			{cards.map((c) => (
				<div
					key={c.label}
					className="rounded-2xl border border-edge bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
				>
					<div className="flex items-center justify-between">
						<span
							className={`grid h-8 w-8 place-items-center rounded-full ${c.tint}`}
						>
							<c.icon className="h-4 w-4" strokeWidth={2.2} />
						</span>
						<ArrowUpRight className="h-3.5 w-3.5 text-mute-2" />
					</div>
					<p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-mute-2">
						{c.label}
					</p>
					<p className="mt-1 text-xl font-bold tabular-nums text-ink">
						{c.value}
					</p>
				</div>
			))}
		</div>
	);
}

function ProtocolsCard({
	rows,
}: {
	rows: { protocol: string; interactionCount: number }[];
}) {
	return (
		<div className="rounded-2xl border border-edge bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
			<div className="flex items-center justify-between border-b border-edge px-5 py-3">
				<h3 className="text-sm font-bold text-ink">Top protocols</h3>
				<span className="text-[11px] font-medium text-mute">{rows.length}</span>
			</div>
			{rows.length === 0 ? (
				<p className="px-5 py-4 text-sm text-mute">—</p>
			) : (
				<ul className="divide-y divide-edge-soft">
					{rows.map((r) => {
						const chip = chipFor(r.protocol);
						return (
							<li
								key={r.protocol}
								className="flex items-center justify-between gap-3 px-5 py-2.5"
							>
								<div className="flex min-w-0 items-center gap-3">
									<span
										className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${chip.className}`}
									>
										{chip.letter}
									</span>
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-ink">
											{r.protocol}
										</p>
										<p className="text-[11px] text-mute">
											{r.interactionCount} interactions
										</p>
									</div>
								</div>
								<span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-2">
									{r.interactionCount}
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

function CounterpartiesCard({
	rows,
}: {
	rows: { address: string; label?: string; count: number }[];
}) {
	return (
		<div className="rounded-2xl border border-edge bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
			<div className="flex items-center justify-between border-b border-edge px-5 py-3">
				<h3 className="text-sm font-bold text-ink">Top counterparties</h3>
				<span className="text-[11px] font-medium text-mute">{rows.length}</span>
			</div>
			{rows.length === 0 ? (
				<p className="px-5 py-4 text-sm text-mute">—</p>
			) : (
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-edge-soft text-[10px] font-semibold uppercase tracking-[0.16em] text-mute-2">
							<th className="px-5 py-2 text-left">Address</th>
							<th className="px-5 py-2 text-right">Count</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-edge-soft">
						{rows.map((r) => (
							<tr key={r.address}>
								<td className="px-5 py-2.5">
									<p
										className={`truncate text-sm font-semibold text-ink ${
											r.label ? "" : "font-mono"
										}`}
									>
										{r.label || `${r.address.slice(0, 10)}…${r.address.slice(-4)}`}
									</p>
									<p className="truncate font-mono text-[11px] text-mute">
										{r.address.slice(0, 10)}…{r.address.slice(-6)}
									</p>
								</td>
								<td className="px-5 py-2.5 text-right text-sm font-semibold tabular-nums text-ink-2">
									{r.count}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}

function RiskFlags({
	flags,
}: {
	flags: { severity: "info" | "warn" | "high"; message: string }[];
}) {
	return (
		<div>
			<div className="mb-2 flex items-center gap-2">
				<AlertTriangle className="h-3.5 w-3.5 text-down" strokeWidth={2.5} />
				<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mute-2">
					Risk flags
				</p>
			</div>
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
		</div>
	);
}
