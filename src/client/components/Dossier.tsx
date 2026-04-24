import { useAgent } from "agents/react";
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
			<section className="flex h-full min-h-0 items-center justify-center text-sm text-zinc-500">
				Select a wallet from the watchlist.
			</section>
		);
	}
	return <DossierPanel key={selected} parentAgent={agent} address={selected} />;
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

	const onRefresh = async () => {
		// Fire through the researcher agent's watchlist entry? No — direct call.
		// We call refresh on the wallet agent stub. Researcher-owned refresh not implemented.
		await (walletAgent as unknown as AgentLike).stub.refresh();
	};

	return (
		<section className="flex h-full min-h-0 flex-col overflow-y-auto px-6 py-4">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<h2 className="font-mono text-sm text-zinc-300">{address}</h2>
					<p className="text-xs text-zinc-500">
						tx count: {state?.txCount ?? 0} · last synced block:{" "}
						{state?.lastSyncedBlock ?? 0} ·{" "}
						{state?.updatedAt
							? new Date(state.updatedAt).toLocaleString()
							: "never"}
					</p>
				</div>
				<button
					type="button"
					onClick={onRefresh}
					className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs hover:border-zinc-500"
				>
					Refresh
				</button>
			</div>

			{dossier && dossier.version > 0 ? (
				<>
					<div className="mb-4 flex flex-wrap gap-1.5">
						{dossier.strategyTags.map((t) => (
							<span
								key={t}
								className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-700/40"
							>
								{t}
							</span>
						))}
					</div>
					<p className="mb-6 text-sm leading-relaxed text-zinc-200">
						{dossier.narrative}
					</p>

					{dossier.riskFlags.length > 0 ? (
						<div className="mb-6">
							<h3 className="mb-2 text-xs font-semibold uppercase text-zinc-400">
								Risk flags
							</h3>
							<ul className="space-y-1">
								{dossier.riskFlags.map((f, i) => (
									<li
										key={i}
										className={`rounded border px-2 py-1 text-xs ${
											f.severity === "high"
												? "border-red-700/60 bg-red-950/40 text-red-200"
												: f.severity === "warn"
													? "border-amber-700/60 bg-amber-950/40 text-amber-200"
													: "border-zinc-700 bg-zinc-900 text-zinc-300"
										}`}
									>
										<span className="mr-2 uppercase">[{f.severity}]</span>
										{f.message}
									</li>
								))}
							</ul>
						</div>
					) : null}

					<div className="mb-6 grid grid-cols-2 gap-4">
						<div>
							<h3 className="mb-2 text-xs font-semibold uppercase text-zinc-400">
								Top protocols
							</h3>
							<ul className="space-y-1 text-xs">
								{dossier.topProtocols.length === 0 ? (
									<li className="text-zinc-500">—</li>
								) : (
									dossier.topProtocols.map((p) => (
										<li
											key={p.protocol}
											className="flex justify-between border-b border-zinc-900 py-0.5"
										>
											<span className="text-zinc-200">{p.protocol}</span>
											<span className="text-zinc-500">
												{p.interactionCount}
											</span>
										</li>
									))
								)}
							</ul>
						</div>
						<div>
							<h3 className="mb-2 text-xs font-semibold uppercase text-zinc-400">
								Top counterparties
							</h3>
							<ul className="space-y-1 text-xs">
								{dossier.topCounterparties.length === 0 ? (
									<li className="text-zinc-500">—</li>
								) : (
									dossier.topCounterparties.map((c) => (
										<li
											key={c.address}
											className="flex justify-between border-b border-zinc-900 py-0.5"
										>
											<span className="truncate font-mono text-zinc-300">
												{c.address.slice(0, 10)}…{c.address.slice(-4)}
											</span>
											<span className="text-zinc-500">{c.count}</span>
										</li>
									))
								)}
							</ul>
						</div>
					</div>
				</>
			) : (
				<p className="text-sm text-zinc-500">
					No dossier yet — click Refresh to kick off ingestion, or wait for the
					10-minute scheduled sweep.
				</p>
			)}
		</section>
	);
}
