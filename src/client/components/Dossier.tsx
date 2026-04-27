import { useAgent } from "agents/react";
import {
	RefreshCw,
	Activity,
	Layers,
	Clock,
	AlertTriangle,
	ArrowUpRight,
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
			<section className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-edge bg-surface text-sm text-zinc-500">
				<div className="grid h-14 w-14 place-items-center rounded-full border border-edge bg-canvas">
					<ArrowUpRight className="h-5 w-5 text-zinc-600" strokeWidth={2} />
				</div>
				<p className="mt-3">Select a wallet from the watchlist.</p>
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
		<section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
			<HeroCard
				address={address}
				txCount={state?.txCount ?? 0}
				lastSyncedBlock={state?.lastSyncedBlock ?? 0}
				updatedAt={state?.updatedAt ?? 0}
				onRefresh={onRefresh}
			/>

			<StatRow
				txCount={state?.txCount ?? 0}
				lastSyncedBlock={state?.lastSyncedBlock ?? 0}
				updatedAt={state?.updatedAt ?? 0}
				riskCount={dossier?.riskFlags.length ?? 0}
			/>

			{hasDossier ? (
				<>
					<div className="grid grid-cols-[280px_1fr] gap-4">
						<StrategyCard tags={dossier.strategyTags} />
						<NarrativeCard narrative={dossier.narrative} />
					</div>

					<div className="grid grid-cols-2 gap-4">
						<ListCard
							title="Top protocols"
							rows={dossier.topProtocols.map((p) => ({
								primary: p.protocol,
								secondary: `${p.interactionCount} interactions`,
								value: String(p.interactionCount),
							}))}
						/>
						<ListCard
							title="Top counterparties"
							rows={dossier.topCounterparties.map((c) => ({
								primary: c.label || `${c.address.slice(0, 10)}…${c.address.slice(-4)}`,
								secondary: c.label
									? `${c.address.slice(0, 10)}…${c.address.slice(-4)}`
									: "no label",
								value: String(c.count),
								mono: true,
							}))}
						/>
					</div>

					{dossier.riskFlags.length > 0 ? (
						<RiskFlagsCard flags={dossier.riskFlags} />
					) : null}
				</>
			) : (
				<div className="rounded-2xl border border-edge bg-surface p-6 text-sm text-zinc-500">
					No dossier yet — click Refresh to kick off ingestion, or wait for the
					10-minute scheduled sweep.
				</div>
			)}
		</section>
	);
}

function HeroCard({
	address,
	txCount,
	lastSyncedBlock,
	updatedAt,
	onRefresh,
}: {
	address: string;
	txCount: number;
	lastSyncedBlock: number;
	updatedAt: number;
	onRefresh: () => Promise<void>;
}) {
	return (
		<div className="rounded-2xl border border-edge bg-surface p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
						Wallet
					</p>
					<h2
						className="mt-1.5 truncate font-mono text-sm text-zinc-300"
						title={address}
					>
						{address}
					</h2>
					<div className="mt-5 flex items-baseline gap-3">
						<span className="text-4xl font-bold tracking-tight tabular-nums text-zinc-50">
							{txCount.toLocaleString()}
						</span>
						<span className="text-sm text-zinc-500">transactions ingested</span>
					</div>
					<p className="mt-1 text-xs text-zinc-500">
						last synced block{" "}
						<span className="font-mono text-zinc-300">
							{lastSyncedBlock.toLocaleString() || "—"}
						</span>{" "}
						· updated {relativeTime(updatedAt)}
					</p>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-3">
					<button
						type="button"
						onClick={onRefresh}
						className="flex items-center gap-1.5 rounded-full border border-edge bg-canvas px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-brand/50 hover:text-brand"
					>
						<RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
						Refresh
					</button>
					<div className="flex gap-1 rounded-full border border-edge bg-canvas p-1 text-[11px] font-semibold">
						<span className="rounded-full bg-brand px-2.5 py-1 text-canvas">
							All
						</span>
						<span className="px-2.5 py-1 text-zinc-500">7d</span>
						<span className="px-2.5 py-1 text-zinc-500">30d</span>
					</div>
				</div>
			</div>
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
			tint: "text-brand",
		},
		{
			label: "Synced block",
			value: lastSyncedBlock ? lastSyncedBlock.toLocaleString() : "—",
			icon: Layers,
			tint: "text-zinc-300",
		},
		{
			label: "Last sync",
			value: relativeTime(updatedAt),
			icon: Clock,
			tint: "text-zinc-300",
		},
		{
			label: "Risk flags",
			value: String(riskCount),
			icon: AlertTriangle,
			tint: riskCount > 0 ? "text-down" : "text-zinc-300",
		},
	];
	return (
		<div className="grid grid-cols-4 gap-3">
			{cards.map((c) => (
				<div
					key={c.label}
					className="rounded-2xl border border-edge bg-surface p-4"
				>
					<div className="flex items-center gap-2.5">
						<span className="grid h-8 w-8 place-items-center rounded-full bg-canvas">
							<c.icon className={`h-4 w-4 ${c.tint}`} strokeWidth={2.2} />
						</span>
						<span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
							{c.label}
						</span>
					</div>
					<p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-zinc-50">
						{c.value}
					</p>
				</div>
			))}
		</div>
	);
}

function StrategyCard({ tags }: { tags: string[] }) {
	return (
		<div className="rounded-2xl bg-brand p-5 text-canvas">
			<div className="flex items-center justify-between">
				<h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-canvas/70">
					Strategy
				</h3>
				<span className="text-[11px] font-semibold text-canvas/60">
					{tags.length} tags
				</span>
			</div>
			{tags.length === 0 ? (
				<p className="mt-4 text-sm font-medium text-canvas/70">
					No tags yet.
				</p>
			) : (
				<ul className="mt-4 space-y-2">
					{tags.slice(0, 6).map((t) => (
						<li
							key={t}
							className="flex items-center justify-between gap-2 rounded-xl bg-canvas/10 px-3 py-2 text-sm font-semibold"
						>
							<span className="truncate">{t}</span>
							<ArrowUpRight className="h-4 w-4 shrink-0 text-canvas/70" />
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function NarrativeCard({ narrative }: { narrative: string }) {
	return (
		<div className="rounded-2xl border border-edge bg-surface p-5">
			<h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
				Narrative
			</h3>
			<p
				data-testid="dossier-narrative"
				className="mt-3 text-sm leading-relaxed text-zinc-200"
			>
				{narrative}
			</p>
		</div>
	);
}

function ListCard({
	title,
	rows,
}: {
	title: string;
	rows: { primary: string; secondary: string; value: string; mono?: boolean }[];
}) {
	return (
		<div className="rounded-2xl border border-edge bg-surface p-5">
			<h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
				{title}
			</h3>
			{rows.length === 0 ? (
				<p className="mt-3 text-sm text-zinc-500">—</p>
			) : (
				<ul className="mt-3 divide-y divide-edge/60">
					{rows.map((r, i) => (
						<li
							key={i}
							className="flex items-center justify-between gap-3 py-2.5"
						>
							<div className="min-w-0">
								<p
									className={`truncate text-sm font-semibold text-zinc-100 ${
										r.mono ? "font-mono" : ""
									}`}
								>
									{r.primary}
								</p>
								<p className="truncate text-[11px] text-zinc-500">
									{r.secondary}
								</p>
							</div>
							<span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold tabular-nums text-zinc-200">
								{r.value}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function RiskFlagsCard({
	flags,
}: {
	flags: { severity: "info" | "warn" | "high"; message: string }[];
}) {
	return (
		<div className="rounded-2xl border border-edge bg-surface p-5">
			<h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
				<AlertTriangle className="h-3.5 w-3.5 text-down" strokeWidth={2.5} />
				Risk flags
			</h3>
			<ul className="mt-3 space-y-2">
				{flags.map((f, i) => (
					<li
						key={i}
						className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
							f.severity === "high"
								? "border-down/40 bg-down/10 text-down"
								: f.severity === "warn"
									? "border-amber-500/30 bg-amber-500/10 text-amber-300"
									: "border-edge bg-canvas text-zinc-300"
						}`}
					>
						<span className="mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
							{f.severity}
						</span>
						<span className="leading-relaxed">{f.message}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
