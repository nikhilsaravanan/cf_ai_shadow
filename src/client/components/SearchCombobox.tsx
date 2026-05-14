import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
} from "react";
import { Plus, Search } from "lucide-react";

const ADDRESS_RE = /^0x[0-9a-f]{40}$/i;

type WatchlistEntry = { address: string; addedAt: number; label?: string };

type Match =
	| { kind: "entry"; entry: WatchlistEntry }
	| { kind: "add"; address: string };

export function SearchCombobox({
	watchlist,
	onSelect,
	onAddAndSelect,
}: {
	watchlist: WatchlistEntry[];
	onSelect: (address: string) => void;
	onAddAndSelect: (address: string) => Promise<void> | void;
}) {
	const [query, setQuery] = useState("");
	const [openIndex, setOpenIndex] = useState(0);
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const matches = useMemo<Match[]>(() => {
		const q = query.trim();
		if (!q) return [];
		const qLower = q.toLowerCase();
		const entryMatches: Match[] = watchlist
			.filter(
				(e) =>
					(e.label?.toLowerCase().includes(qLower) ?? false) ||
					e.address.includes(qLower),
			)
			.map((e) => ({ kind: "entry" as const, entry: e }));

		if (ADDRESS_RE.test(q)) {
			const addr = q.toLowerCase();
			const alreadyWatched = watchlist.some((e) => e.address === addr);
			if (!alreadyWatched) {
				entryMatches.push({ kind: "add", address: addr });
			}
		}
		return entryMatches;
	}, [query, watchlist]);

	// Reset highlight whenever the result set changes shape.
	useEffect(() => {
		setOpenIndex(0);
	}, [matches.length]);

	// Click-outside closes the dropdown.
	useEffect(() => {
		const onDocClick = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", onDocClick);
		return () => document.removeEventListener("mousedown", onDocClick);
	}, []);

	const activate = (m: Match) => {
		if (m.kind === "entry") {
			onSelect(m.entry.address);
		} else {
			void onAddAndSelect(m.address);
		}
		setQuery("");
		setIsOpen(false);
		inputRef.current?.blur();
	};

	const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			setQuery("");
			setIsOpen(false);
			return;
		}
		if (!matches.length) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setOpenIndex((i) => (i + 1) % matches.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setOpenIndex((i) => (i - 1 + matches.length) % matches.length);
		} else if (e.key === "Enter") {
			e.preventDefault();
			const m = matches[openIndex];
			if (m) activate(m);
		}
	};

	const showDropdown = isOpen && query.trim().length > 0;

	return (
		<div ref={containerRef} className="relative w-full max-w-md">
			<div className="glass-soft flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
				<Search className="h-4 w-4 text-mute-2" strokeWidth={2} />
				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setIsOpen(true);
					}}
					onFocus={() => setIsOpen(true)}
					onKeyDown={onKeyDown}
					placeholder="Type a wallet address or label…"
					spellCheck={false}
					className="flex-1 bg-transparent text-ink placeholder:text-mute focus:outline-none"
				/>
			</div>

			{showDropdown ? (
				<ul className="glass absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-edge py-1 shadow-lg">
					{matches.length === 0 ? (
						<li className="px-3 py-2 text-xs text-mute">No matches.</li>
					) : (
						matches.map((m, i) => (
							<li
								key={
									m.kind === "entry"
										? m.entry.address
										: `add:${m.address}`
								}
							>
								<button
									type="button"
									onMouseDown={(e) => {
										// onMouseDown beats input blur, so the click registers
										// before the dropdown closes from focus loss.
										e.preventDefault();
										activate(m);
									}}
									onMouseEnter={() => setOpenIndex(i)}
									className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${
										i === openIndex
											? "bg-gradient-to-r from-brand/15 via-brand-soft to-brand-2/15 ring-1 ring-brand/30"
											: "hover:bg-white/[0.04]"
									}`}
								>
									{m.kind === "entry" ? (
										<EntryRow entry={m.entry} />
									) : (
										<AddRow address={m.address} />
									)}
								</button>
							</li>
						))
					)}
				</ul>
			) : null}
		</div>
	);
}

function EntryRow({ entry }: { entry: WatchlistEntry }) {
	const letter = (
		entry.label?.charAt(0) || entry.address.charAt(2)
	).toUpperCase();
	return (
		<>
			<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">
				{letter}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-semibold text-ink">
					{entry.label || "Unlabeled"}
				</span>
				<span className="block truncate font-mono text-[10px] text-mute">
					{entry.address.slice(0, 10)}…{entry.address.slice(-6)}
				</span>
			</span>
		</>
	);
}

function AddRow({ address }: { address: string }) {
	return (
		<>
			<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-white">
				<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-xs font-semibold text-ink">
					Add and view
				</span>
				<span className="block truncate font-mono text-[10px] text-mute">
					{address.slice(0, 10)}…{address.slice(-6)}
				</span>
			</span>
			<span className="rounded-full bg-canvas px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mute-2">
				new
			</span>
		</>
	);
}
