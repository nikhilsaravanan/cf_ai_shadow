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
		<div className="relative h-full overflow-hidden">
			<BackgroundBlobs />

			<div className="relative grid h-full grid-cols-[260px_1fr]">
				<Watchlist
					agent={agent}
					state={state}
					selected={selected}
					onSelect={setSelected}
				/>

				<div className="grid min-h-0 grid-rows-[64px_1fr]">
					<header className="flex items-center gap-4 border-b border-edge px-6">
						<div className="glass-soft flex w-full max-w-md items-center gap-2 rounded-xl px-3 py-2 text-sm text-mute">
							<Search className="h-4 w-4 text-mute-2" strokeWidth={2} />
							<span className="select-none">
								Type a wallet address or label…
							</span>
						</div>
						<nav className="ml-2 flex items-center gap-1.5 text-xs">
							<span className="text-mute">Welcome</span>
							<ChevronRight
								className="h-3 w-3 text-mute-2"
								strokeWidth={2.5}
							/>
							<span className="font-semibold text-brand-strong">Dashboard</span>
						</nav>
						<div className="ml-auto flex items-center gap-1">
							<button
								type="button"
								aria-label="settings"
								className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-ink"
							>
								<SettingsIcon className="h-4 w-4" strokeWidth={2} />
							</button>
							<button
								type="button"
								aria-label="notifications"
								className="relative grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-ink"
							>
								<Bell className="h-4 w-4" strokeWidth={2} />
								{state.watchlist.length > 0 ? (
									<span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-2 px-1 text-[9px] font-bold text-white">
										{state.watchlist.length}
									</span>
								) : null}
							</button>
							<div className="ml-2 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10 text-xs font-bold text-brand-strong backdrop-blur-md">
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
		</div>
	);
}

function BackgroundBlobs() {
	return (
		<div
			className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
			aria-hidden="true"
		>
			<div className="absolute inset-0 bg-canvas" />
			{/* yellow blob — top left */}
			<div
				className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full opacity-90"
				style={{
					background:
						"radial-gradient(circle, var(--color-blob-yellow) 0%, transparent 60%)",
					filter: "blur(80px)",
				}}
			/>
			{/* orange blob — top right */}
			<div
				className="absolute -right-40 top-10 h-[560px] w-[560px] rounded-full opacity-80"
				style={{
					background:
						"radial-gradient(circle, var(--color-blob-orange) 0%, transparent 60%)",
					filter: "blur(90px)",
				}}
			/>
			{/* violet blob — bottom left */}
			<div
				className="absolute -bottom-40 left-1/4 h-[640px] w-[640px] rounded-full opacity-75"
				style={{
					background:
						"radial-gradient(circle, var(--color-blob-violet) 0%, transparent 60%)",
					filter: "blur(100px)",
				}}
			/>
			{/* teal blob — bottom right */}
			<div
				className="absolute -bottom-32 -right-20 h-[480px] w-[480px] rounded-full opacity-70"
				style={{
					background:
						"radial-gradient(circle, var(--color-blob-teal) 0%, transparent 60%)",
					filter: "blur(80px)",
				}}
			/>
			{/* pink blob — center, faint */}
			<div
				className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-50"
				style={{
					background:
						"radial-gradient(circle, var(--color-blob-pink) 0%, transparent 60%)",
					filter: "blur(70px)",
				}}
			/>
		</div>
	);
}
