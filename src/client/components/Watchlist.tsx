import { useState, type FormEvent } from "react";
import type { ResearcherAgent, ResearcherState } from "../../server";

type AgentLike = {
	stub: {
		addToWatchlist: (address: string, label?: string) => Promise<unknown>;
		removeFromWatchlist: (address: string) => Promise<unknown>;
	};
};

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

	const onRemove = async (address: string) => {
		await (agent as { stub: ResearcherAgent }).stub.removeFromWatchlist(address);
		if (selected === address) onSelect(null);
	};

	return (
		<aside className="flex h-full min-h-0 flex-col border-r border-zinc-800">
			<div className="px-4 py-3">
				<h2 className="text-sm font-semibold text-zinc-200">Watchlist</h2>
			</div>
			<form onSubmit={onSubmit} className="space-y-2 px-4 pb-3">
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="0x…"
					className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs focus:border-zinc-500 focus:outline-none"
					spellCheck={false}
				/>
				<input
					type="text"
					value={label}
					onChange={(e) => setLabel(e.target.value)}
					placeholder="label (optional)"
					className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs focus:border-zinc-500 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={pending}
					className="w-full rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
				>
					{pending ? "adding…" : "Add wallet"}
				</button>
				{error ? <p className="text-xs text-red-400">{error}</p> : null}
			</form>
			<ul className="min-h-0 flex-1 overflow-y-auto border-t border-zinc-800">
				{state.watchlist.length === 0 ? (
					<li className="px-4 py-3 text-xs text-zinc-500">
						No wallets yet. Add one to start ingesting.
					</li>
				) : (
					state.watchlist.map((entry) => {
						const isActive = selected === entry.address;
						return (
							<li
								key={entry.address}
								className={`group border-b border-zinc-900 px-4 py-2 ${
									isActive ? "bg-zinc-900" : "hover:bg-zinc-900/50"
								}`}
							>
								<button
									type="button"
									onClick={() => onSelect(entry.address)}
									className="block w-full text-left"
								>
									<div className="truncate text-xs font-mono text-zinc-200">
										{entry.address.slice(0, 10)}…{entry.address.slice(-6)}
									</div>
									{entry.label ? (
										<div className="truncate text-xs text-zinc-400">
											{entry.label}
										</div>
									) : null}
								</button>
								<button
									type="button"
									onClick={() => onRemove(entry.address)}
									className="mt-1 text-[10px] text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
								>
									remove
								</button>
							</li>
						);
					})
				)}
			</ul>
		</aside>
	);
}
