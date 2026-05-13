import { useState } from "react";
import { useAgent } from "agents/react";
import { Search, Bell, Settings as SettingsIcon, ChevronRight, LogOut } from "lucide-react";
import type { ResearcherAgent, ResearcherState } from "../server";
import { Watchlist } from "./components/Watchlist";
import { Dossier } from "./components/Dossier";
import { RightRail } from "./components/RightRail";
import { useAuth, useAuthedAgentOptions } from "./lib/auth";

const EMPTY_STATE: ResearcherState = { watchlist: [], createdAt: 0 };

export function App() {
	const [selected, setSelected] = useState<string | null>(null);
	const { user, signOut } = useAuth();
	const authedOptions = useAuthedAgentOptions(user.id);

	const agent = useAgent<ResearcherAgent, ResearcherState>({
		agent: "researcher-agent",
		name: user.id,
		...authedOptions,
	});

	const state = agent.state ?? EMPTY_STATE;

	return (
		<div className="relative h-full overflow-hidden">
			<BackgroundBlobs />

			<div className="relative grid h-full grid-cols-[260px_minmax(0,1fr)]">
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
							<button
								type="button"
								onClick={signOut}
								aria-label="sign out"
								title={user.email ?? "sign out"}
								className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-white/5 hover:text-ink"
							>
								<LogOut className="h-4 w-4" strokeWidth={2} />
							</button>
							<div
								className="ml-2 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/10 text-xs font-bold text-brand-strong backdrop-blur-md"
								title={user.email ?? user.id}
							>
								{(user.email ?? user.id).charAt(0).toUpperCase()}
							</div>
						</div>
					</header>

					<main className="grid min-h-0 grid-cols-[minmax(0,1fr)_360px] gap-4 overflow-hidden p-4">
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
			{/* very faint violet wash — top right */}
			<div
				className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full opacity-15"
				style={{
					background:
						"radial-gradient(circle, var(--color-blob-violet) 0%, transparent 65%)",
					filter: "blur(100px)",
				}}
			/>
			{/* very faint teal wash — bottom left */}
			<div
				className="absolute -bottom-40 -left-32 h-[580px] w-[580px] rounded-full opacity-12"
				style={{
					background:
						"radial-gradient(circle, var(--color-blob-teal) 0%, transparent 65%)",
					filter: "blur(100px)",
				}}
			/>
		</div>
	);
}
