import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { ResearcherAgent, ResearcherState } from "../../server";

type AgentLike = {
	stub: {
		addToWatchlist: (address: string, label?: string) => Promise<unknown>;
		removeFromWatchlist: (address: string) => Promise<unknown>;
	};
};

function avatarSeed(s: string): string {
	const c = s.replace(/^0x/, "").charAt(0).toUpperCase();
	return c || "?";
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
		<aside className="flex h-full min-h-0 flex-col rounded-2xl border border-edge bg-surface">
			<div className="flex items-center justify-between px-4 pt-4 pb-3">
				<h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
					Watchlist
				</h2>
				<span className="text-[11px] text-zinc-500">
					{state.watchlist.length}
				</span>
			</div>
			<ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
				{state.watchlist.length === 0 ? (
					<li className="px-3 py-3 text-xs text-zinc-500">
						No wallets yet. Add one to start ingesting.
					</li>
				) : (
					state.watchlist.map((entry) => {
						const isActive = selected === entry.address;
						const seed = avatarSeed(entry.label || entry.address);
						return (
							<li
								key={entry.address}
								className={`group flex items-center gap-2 rounded-xl px-1.5 py-1 transition ${
									isActive ? "bg-canvas ring-1 ring-brand/40" : "hover:bg-canvas/60"
								}`}
							>
								<button
									type="button"
									onClick={() => onSelect(entry.address)}
									className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1.5 text-left"
								>
									<span
										className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
											isActive
												? "bg-brand text-canvas"
												: "bg-surface-2 text-zinc-300 group-hover:bg-edge"
										}`}
									>
										{seed}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold text-zinc-100">
											{entry.label || "Unlabeled"}
										</span>
										<span className="block truncate font-mono text-[11px] text-zinc-500">
											{entry.address.slice(0, 10)}…{entry.address.slice(-6)}
										</span>
									</span>
								</button>
								<button
									type="button"
									onClick={(e) => onRemove(e, entry.address)}
									aria-label="remove"
									className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:bg-down/15 hover:text-down"
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
				className="border-t border-edge/60 p-3 space-y-2"
			>
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="0x…"
					className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/30"
					spellCheck={false}
				/>
				<input
					type="text"
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder="label (optional)"
					className="w-full rounded-lg border border-edge bg-canvas px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-brand/60 focus:outline-none focus:ring-1 focus:ring-brand/30"
				/>
				<button
					type="submit"
					disabled={pending}
					className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-canvas transition hover:bg-brand-hover disabled:opacity-50"
				>
					<Plus className="h-3.5 w-3.5" strokeWidth={3} />
					{pending ? "adding…" : "Add wallet"}
				</button>
				{error ? (
					<p className="text-xs text-down">{error}</p>
				) : null}
			</form>
		</aside>
	);
}
