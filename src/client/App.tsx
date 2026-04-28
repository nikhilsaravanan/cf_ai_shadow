import { useState } from "react";
import { useAgent } from "agents/react";
import { Search, Bell, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import type { ResearcherAgent, ResearcherState } from "../server";
import { Watchlist } from "./components/Watchlist";
import { Dossier } from "./components/Dossier";
import { RightRail } from "./components/RightRail";

const EMPTY_STATE: ResearcherState = { watchlist: [], createdAt: 0 };

export function App() {
	const [selected, setSelected] = useState<string | null>(null);

	const agent = useAgent<ResearcherAgent, ResearcherState>({
		agent: "researcher-agent",
		name: "default",
	});

	const state = agent.state ?? EMPTY_STATE;

	return (
		<div className="grid h-full grid-cols-[260px_1fr] bg-canvas">
			<Watchlist
				agent={agent}
				state={state}
				selected={selected}
				onSelect={setSelected}
			/>

			<div className="grid min-h-0 grid-rows-[64px_1fr]">
				<header className="flex items-center gap-4 border-b border-edge bg-surface px-6">
					<div className="flex items-center gap-2 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm text-mute w-full max-w-md">
						<Search className="h-4 w-4 text-mute-2" strokeWidth={2} />
						<span className="select-none">
							Type a wallet address or label…
						</span>
					</div>
					<nav className="ml-2 flex items-center gap-1.5 text-xs">
						<span className="text-mute">Welcome</span>
						<ChevronRight className="h-3 w-3 text-mute-2" strokeWidth={2.5} />
						<span className="font-semibold text-brand-strong">Dashboard</span>
					</nav>
					<div className="ml-auto flex items-center gap-1">
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
						<div className="ml-2 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-xs font-bold text-white">
							S
						</div>
					</div>
				</header>

				<main className="grid min-h-0 grid-cols-[1fr_360px] gap-4 overflow-hidden p-4">
					<Dossier agent={agent} selected={selected} />
					<RightRail agent={agent} selected={selected} />
				</main>
			</div>
		</div>
	);
}
