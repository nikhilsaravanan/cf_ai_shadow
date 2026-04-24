import { useState } from "react";
import { useAgent } from "agents/react";
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
		<div className="flex h-full flex-col">
			<header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
				<div>
					<h1 className="text-lg font-semibold">Shadow</h1>
					<p className="text-xs text-zinc-400">
						DeFi wallet research — Ethereum mainnet
					</p>
				</div>
				<span className="text-xs text-zinc-500">
					{state.watchlist.length} watched
				</span>
			</header>
			<main className="grid min-h-0 flex-1 grid-cols-[260px_1fr_360px]">
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
