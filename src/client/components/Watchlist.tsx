import { useState, type FormEvent } from "react";
import {
	Plus,
	X,
	LayoutDashboard,
	BarChart3,
	List,
	BookOpen,
	HelpCircle,
	LogOut,
	Eye,
} from "lucide-react";
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

const STATIC_NAV = [
	{ icon: LayoutDashboard, label: "Dashboard", active: true },
	{ icon: BarChart3, label: "Analytics", active: false },
];

const ACCOUNT_NAV = [
	{ icon: BookOpen, label: "Documentation" },
	{ icon: HelpCircle, label: "FAQ" },
];

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
	const [adding, setAdding] = useState(false);

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
			setAdding(false);
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
		<aside className="flex h-full min-h-0 flex-col border-r border-edge bg-surface">
			<div className="flex items-center gap-2.5 border-b border-edge px-5 py-4">
				<span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-sm">
					<svg
						viewBox="0 0 24 24"
						className="h-5 w-5"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
					</svg>
				</span>
				<div className="leading-tight">
					<h1 className="text-base font-bold tracking-tight text-ink">
						Shadow
					</h1>
					<p className="text-[10px] uppercase tracking-[0.18em] text-mute">
						DeFi Research
					</p>
				</div>
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto px-3 pt-4 pb-3">
				<NavSection title="Quick Access">
					{STATIC_NAV.map((n) => (
						<NavItem
							key={n.label}
							icon={n.icon}
							label={n.label}
							active={n.active}
						/>
					))}
				</NavSection>

				<NavSection title="Watchlist" trailing={state.watchlist.length}>
					<ul className="space-y-0.5">
						{state.watchlist.length === 0 ? (
							<li className="px-3 py-2 text-xs text-mute">
								No wallets yet.
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
												className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${av.className}`}
											>
												{av.letter}
											</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-semibold text-ink">
													{entry.label || "Unlabeled"}
												</span>
												<span className="block truncate font-mono text-[10px] text-mute">
													{entry.address.slice(0, 10)}…{entry.address.slice(-6)}
												</span>
											</span>
											{isActive ? (
												<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-2" />
											) : null}
										</button>
										<button
											type="button"
											onClick={(e) => onRemove(e, entry.address)}
											aria-label="remove"
											className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-mute-2 opacity-0 transition group-hover:opacity-100 hover:bg-down/10 hover:text-down"
										>
											<X className="h-3 w-3" strokeWidth={2.5} />
										</button>
									</li>
								);
							})
						)}
					</ul>

					{adding ? (
						<form
							onSubmit={onSubmit}
							className="mt-2 space-y-2 rounded-xl border border-edge bg-surface-2 p-2.5"
						>
							<input
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="0x…"
								className="w-full rounded-lg border border-edge bg-surface px-2.5 py-1.5 font-mono text-xs text-ink placeholder:text-mute-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
								spellCheck={false}
								autoFocus
							/>
							<input
								type="text"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder="label (optional)"
								className="w-full rounded-lg border border-edge bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-mute-2 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
							/>
							<div className="flex gap-1.5">
								<button
									type="submit"
									disabled={pending}
									className="flex-1 rounded-lg bg-gradient-to-r from-brand to-brand-2 px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
								>
									{pending ? "…" : "Add"}
								</button>
								<button
									type="button"
									onClick={() => {
										setAdding(false);
										setInput("");
										setLabel("");
										setError(null);
									}}
									className="rounded-lg border border-edge bg-surface px-2 py-1.5 text-[11px] font-semibold text-mute hover:text-ink"
								>
									Cancel
								</button>
							</div>
							{error ? <p className="text-[11px] text-down">{error}</p> : null}
						</form>
					) : (
						<button
							type="button"
							onClick={() => setAdding(true)}
							className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-edge bg-surface-2 px-3 py-2 text-xs font-semibold text-mute transition hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
						>
							<Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
							Add wallet
						</button>
					)}
				</NavSection>

				<NavSection title="Service">
					<NavItem icon={Eye} label="Recent activity" active={false} />
					<NavItem icon={List} label="Saved queries" active={false} />
				</NavSection>

				<NavSection title="Account">
					{ACCOUNT_NAV.map((n) => (
						<NavItem key={n.label} icon={n.icon} label={n.label} />
					))}
				</NavSection>
			</div>

			<div className="border-t border-edge px-3 py-3">
				<button
					type="button"
					className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-mute hover:bg-canvas hover:text-ink"
				>
					<LogOut className="h-4 w-4" strokeWidth={2} />
					Log out
				</button>
			</div>
		</aside>
	);
}

function NavSection({
	title,
	trailing,
	children,
}: {
	title: string;
	trailing?: number;
	children: React.ReactNode;
}) {
	return (
		<div className="mb-4">
			<div className="mb-1.5 flex items-center justify-between px-3">
				<h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-mute-2">
					{title}
				</h2>
				{trailing !== undefined ? (
					<span className="rounded-full bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-mute">
						{trailing}
					</span>
				) : null}
			</div>
			{children}
		</div>
	);
}

function NavItem({
	icon: Icon,
	label,
	active = false,
}: {
	icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
	label: string;
	active?: boolean;
}) {
	return (
		<button
			type="button"
			className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
				active
					? "bg-gradient-to-r from-brand/15 via-brand-soft to-brand-2/15 text-brand-strong ring-1 ring-brand/25"
					: "text-mute hover:bg-canvas hover:text-ink"
			}`}
		>
			<Icon
				className={`h-4 w-4 ${active ? "text-brand-2" : ""}`}
				strokeWidth={2}
			/>
			{label}
		</button>
	);
}
