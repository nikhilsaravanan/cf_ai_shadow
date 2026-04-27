import { useState } from "react";
import { useAgent } from "agents/react";
import { Moon, Search } from "lucide-react";
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
			<header className="flex items-center gap-6 border-b border-edge/60 px-6 py-4">
				<div className="flex items-center gap-2.5">
					<span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-canvas">
						<Moon className="h-4 w-4" strokeWidth={2.5} />
					</span>
					<div className="leading-tight">
						<h1 className="text-base font-bold tracking-tight text-zinc-100">
							Shadow
						</h1>
						<p className="text-[11px] text-zinc-500">
							DeFi wallet research — Ethereum mainnet
						</p>
					</div>
				</div>
				<div className="ml-6 flex max-w-md flex-1 items-center gap-2 rounded-full border border-edge bg-surface px-4 py-2 text-sm text-zinc-500">
					<Search className="h-4 w-4 text-zinc-500" strokeWidth={2} />
					<span className="select-none">
						Search wallets, protocols, transactions…
					</span>
				</div>
				<div className="ml-auto flex items-center gap-3">
					<span className="rounded-full border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-zinc-300">
						{state.watchlist.length}{" "}
						<span className="text-zinc-500">watched</span>
					</span>
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
