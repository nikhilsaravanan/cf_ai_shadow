import { useAgent } from "agents/react";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import type { WalletAgent, WalletState } from "../../walletAgent";
import { Chat } from "./Chat";

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

export function RightRail({
	agent,
	selected,
}: {
	agent: unknown;
	selected: string | null;
}) {
	return (
		<div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr] gap-4 overflow-hidden">
			{selected ? <ProtocolsRail address={selected} /> : null}
			<Chat agent={agent} selected={selected} />
		</div>
	);
}

function ProtocolsRail({ address }: { address: string }) {
	const walletAgent = useAgent<WalletAgent, WalletState>({
		agent: "wallet-agent",
		name: address,
	});
	const protocols = walletAgent.state?.dossier?.topProtocols ?? [];
	const total = protocols.reduce((s, p) => s + p.interactionCount, 0) || 1;

	return (
		<div className="glass rounded-2xl">
			<div className="flex items-center justify-between border-b border-edge px-5 py-3.5">
				<div className="flex items-center gap-2">
					<TrendingUp className="h-4 w-4 text-brand-2" strokeWidth={2.5} />
					<h3 className="text-sm font-bold text-ink">Top protocols</h3>
				</div>
				<span className="text-[11px] text-mute">{protocols.length}</span>
			</div>
			{protocols.length === 0 ? (
				<p className="px-5 py-4 text-sm text-mute">
					No protocol data yet.
				</p>
			) : (
				<ul className="divide-y divide-edge-soft">
					{protocols.slice(0, 8).map((p) => {
						const chip = chipFor(p.protocol);
						const pct = (p.interactionCount / total) * 100;
						return (
							<li
								key={p.protocol}
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
											{p.protocol}
										</p>
										<p className="text-[11px] text-mute">
											{pct.toFixed(1)}% of activity
										</p>
									</div>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="text-sm font-bold tabular-nums text-ink">
										{p.interactionCount}
									</span>
									<ArrowUpRight
										className="h-3.5 w-3.5 text-up"
										strokeWidth={2.5}
									/>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
