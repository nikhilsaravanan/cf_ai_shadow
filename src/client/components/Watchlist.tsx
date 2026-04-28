import { useState, type FormEvent } from "react";
import { Plus, X, Wallet } from "lucide-react";
import type { ResearcherAgent, ResearcherState } from "../../server";

type AgentLike = {
	stub: {
		addToWatchlist: (address: string, label?: string) => Promise<unknown>;
		removeFromWatchlist: (address: string) => Promise<unknown>;
	};
};

const AVATAR_PALETTE = [
	"bg-amber-100 text-amber-700",
	"bg-orange-100 text-orange-700",
	"bg-rose-100 text-rose-700",
	"bg-violet-100 text-violet-700",
	"bg-sky-100 text-sky-700",
	"bg-emerald-100 text-emerald-700",
	"bg-teal-100 text-teal-700",
	"bg-fuchsia-100 text-fuchsia-700",
];

function avatarFor(seed: string): { className: string; letter: string } {
	const cleaned = seed.replace(/^0x/i, "");
	let hash = 0;
	for (const ch of cleaned) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
	const letter = (cleaned.charAt(0) || "?").toUpperCase();
	return {
		letter,
		className: AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length],
	};
}

export function Watchlist({
	agent,
	state,
	selected,
	onSelect,
}: {
	agent: AgentLike | unknown;
	state: ResearcherState;
	selected: string | null;
	onSelect: (address: string | null) => void;
}) {
	const [input, setInput] = useState("");
	const [label, setLabel] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		const a = input.trim();
		if (!/^0x[0-9a-f]{40}$/i.test(a)) {
			setError("address must be 0x-prefixed, 40 hex chars");
			return;
		}
		setPending(true);
		try {
			await (agent as { stub: ResearcherAgent }).stub.addToWatchlist(
				a,
				label.trim() || undefined,
			);
			setInput("");
			setLabel("");
			onSelect(a.toLowerCase());
		} catch (err) {
			setError(String(err instanceof Error ? err.message : err));
		} finally {
			setPending(false);
		}
	};

	const onRemove = async (e: React.MouseEvent, address: string) => {
		e.stopPropagation();
		await (agent as { stub: ResearcherAgent }).stub.removeFromWatchlist(address);
		if (selected === address) onSelect(null);
	};

	return (
		<aside className="flex h-full min-h-0 flex-col rounded-2xl border border-edge bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
			<div className="flex items-center justify-between px-5 pt-5 pb-3">
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mute-2">
						Quick access
					</p>
					<h2 className="mt-1 flex items-center gap-2 text-sm font-bold text-ink">
						<Wallet className="h-4 w-4 text-brand-2" strokeWidth={2.5} />
						Watchlist
					</h2>
				</div>
				<span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-semibold text-mute">
					{state.watchlist.length}
				</span>
			</div>
			<ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
				{state.watchlist.length === 0 ? (
					<li className="px-3 py-3 text-xs text-mute">
						No wallets yet. Add one to start ingesting.
					</li>
				) : (
					state.watchlist.map((entry) => {
						const isActive = selected === entry.address;
						const av = avatarFor(entry.label || entry.address);
						return (
							<li
								key={entry.address}
								className={`group flex items-center gap-2 rounded-xl px-1.5 py-1 transition ${
									isActive
										? "bg-gradient-to-r from-brand/15 via-brand-soft to-brand-2/15 ring-1 ring-brand/30"
										: "hover:bg-canvas"
								}`}
							>
								<button
									type="button"
									onClick={() => onSelect(entry.address)}
									className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1.5 text-left"
								>
									<span
										className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${av.className}`}
									>
										{av.letter}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold text-ink">
											{entry.label || "Unlabeled"}
										</span>
										<span className="block truncate font-mono text-[11px] text-mute">
											{entry.address.slice(0, 10)}…{entry.address.slice(-6)}
										</span>
									</span>
									{isActive ? (
										<span className="h-2 w-2 shrink-0 rounded-full bg-brand-2" />
									) : null}
								</button>
								<button
									type="button"
									onClick={(e) => onRemove(e, entry.address)}
									aria-label="remove"
									className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-mute-2 opacity-0 transition group-hover:opacity-100 hover:bg-down/10 hover:text-down"
								>
									<X className="h-3.5 w-3.5" strokeWidth={2.5} />
								</button>
							</li>
						);
					})
				)}
			</ul>

			<form
				onSubmit={onSubmit}
				className="space-y-2 border-t border-edge p-3"
			>
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="0x…"
					className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 font-mono text-xs text-ink placeholder:text-mute-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
					spellCheck={false}
				/>
				<input
					type="text"
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder="label (optional)"
					className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-xs text-ink placeholder:text-mute-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
				/>
				<button
					type="submit"
					disabled={pending}
					className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-brand-2 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
				>
					<Plus className="h-3.5 w-3.5" strokeWidth={3} />
					{pending ? "adding…" : "Add wallet"}
				</button>
				{error ? <p className="text-xs text-down">{error}</p> : null}
			</form>
		</aside>
	);
}
