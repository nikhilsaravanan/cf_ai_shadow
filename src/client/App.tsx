import { useState } from "react";
import { useAgent } from "agents/react";
import { Search, Bell, Settings as SettingsIcon } from "lucide-react";
import type { ResearcherAgent, ResearcherState } from "../server";
import { Watchlist } from "./components/Watchlist";
import { Dossier } from "./components/Dossier";
import { Chat } from "./components/Chat";

const EMPTY_STATE: ResearcherState = { watchlist: [], createdAt: 0 };

export function App() {
	const [selected, setSelected] = useState<string | null>(null);

	const agent = useAgent<ResearcherAgent, ResearcherState>({
		agent: "researcher-agent",
		name: "default",
	});

	const state = agent.state ?? EMPTY_STATE;

	return (
		<div className="flex h-full flex-col bg-canvas">
			<header className="flex items-center gap-6 border-b border-edge bg-surface px-6 py-3">
				<div className="flex items-center gap-2.5">
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
						<p className="text-[11px] text-mute">
							DeFi wallet research — Ethereum mainnet
						</p>
					</div>
				</div>
				<div className="ml-6 flex max-w-md flex-1 items-center gap-2 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm text-mute">
					<Search className="h-4 w-4 text-mute-2" strokeWidth={2} />
					<span className="select-none">Type a wallet address or label…</span>
				</div>
				<div className="ml-auto flex items-center gap-2">
					<button
						type="button"
						aria-label="settings"
						className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-canvas hover:text-ink"
					>
						<SettingsIcon className="h-4 w-4" strokeWidth={2} />
					</button>
					<button
						type="button"
						aria-label="notifications"
						className="relative grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-canvas hover:text-ink"
					>
						<Bell className="h-4 w-4" strokeWidth={2} />
						{state.watchlist.length > 0 ? (
							<span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-2 px-1 text-[9px] font-bold text-white">
								{state.watchlist.length}
							</span>
						) : null}
					</button>
				</div>
			</header>

			<main className="grid min-h-0 flex-1 grid-cols-[260px_1fr_380px] gap-4 p-4">
				<Watchlist
					agent={agent}
					state={state}
					selected={selected}
					onSelect={setSelected}
				/>
				<Dossier agent={agent} selected={selected} />
				<Chat agent={agent} selected={selected} />
			</main>
		</div>
	);
}
