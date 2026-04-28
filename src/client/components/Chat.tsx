import { useState, type FormEvent } from "react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { ArrowUp, MessageSquare, ChevronDown, Sparkles } from "lucide-react";

export function Chat({
	agent,
	selected,
}: {
	agent: unknown;
	selected: string | null;
}) {
	const chat = useAgentChat({
		// biome-ignore lint/suspicious/noExplicitAny: useAgentChat accepts an untyped AgentConnection
		agent: agent as any,
	});
	const [input, setInput] = useState("");

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		const text = input.trim();
		if (!text) return;
		setInput("");
		await chat.sendMessage({ text });
	};

	return (
		<aside className="flex h-full min-h-0 flex-col rounded-2xl border border-edge bg-surface shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
			<div className="flex items-start justify-between border-b border-edge px-5 py-4">
				<div className="min-w-0">
					<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mute-2">
						Newsfeed
					</p>
					<h2 className="mt-1 flex items-center gap-2 text-sm font-bold text-ink">
						<MessageSquare className="h-4 w-4 text-brand-2" strokeWidth={2.5} />
						Chat
					</h2>
					{selected ? (
						<p className="mt-1 truncate font-mono text-[11px] text-mute">
							{selected.slice(0, 10)}…{selected.slice(-6)}
						</p>
					) : (
						<p className="mt-1 text-[11px] text-mute">
							Ask about any wallet on your watchlist.
						</p>
					)}
				</div>
			</div>

			<ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
				{chat.messages.length === 0 ? (
					<li className="rounded-xl border border-dashed border-edge bg-surface-2 px-3 py-3 text-xs text-mute">
						<div className="mb-1 flex items-center gap-1.5 text-ink">
							<Sparkles className="h-3 w-3 text-brand-2" strokeWidth={2.5} />
							<span className="text-[11px] font-semibold">Try asking</span>
						</div>
						<p>
							"summarize my watchlist" or "tell me about this wallet"
						</p>
					</li>
				) : (
					chat.messages.map((m) => <MessageBubble key={m.id} message={m} />)
				)}
				{chat.isStreaming ? (
					<li className="flex items-center gap-1.5 px-2 text-[11px] text-mute">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-2" />
						streaming…
					</li>
				) : null}
			</ul>

			<form onSubmit={onSubmit} className="border-t border-edge p-3">
				<div className="flex items-center gap-2 rounded-full border border-edge bg-surface-2 pl-4 pr-1.5 py-1.5 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="ask shadow…"
						className="flex-1 bg-transparent text-sm text-ink placeholder:text-mute focus:outline-none"
					/>
					<button
						type="submit"
						disabled={chat.isStreaming || !input.trim()}
						aria-label="Send"
						className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-r from-brand to-brand-2 text-white shadow-sm transition hover:brightness-105 disabled:opacity-40"
					>
						<ArrowUp className="h-4 w-4" strokeWidth={3} />
					</button>
				</div>
			</form>
		</aside>
	);
}

type UIMessage = {
	id: string;
	role: string;
	parts: Array<{ type: string } & Record<string, unknown>>;
};

function MessageBubble({ message }: { message: UIMessage }) {
	const isUser = message.role === "user";
	return (
		<li
			data-role={message.role}
			className={`flex ${isUser ? "justify-end" : "justify-start"}`}
		>
			<div
				className={`relative max-w-[85%] space-y-1.5 rounded-2xl px-3.5 py-2.5 text-sm ${
					isUser
						? "bg-gradient-to-r from-brand to-brand-2 text-white shadow-sm"
						: "border border-edge bg-surface text-ink shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
				}`}
			>
				{!isUser ? (
					<span className="absolute -left-px top-3 h-5 w-1 rounded-r bg-gradient-to-b from-brand to-brand-2" />
				) : null}
				{message.parts.map((part, i) => {
					if (part.type === "text") {
						return (
							<p key={i} className="whitespace-pre-wrap leading-relaxed">
								{String(part.text ?? "")}
							</p>
						);
					}
					if (part.type.startsWith("tool-")) {
						return <ToolCard key={i} part={part} isUser={isUser} />;
					}
					return null;
				})}
			</div>
		</li>
	);
}

function ToolCard({
	part,
	isUser,
}: {
	part: { type: string } & Record<string, unknown>;
	isUser: boolean;
}) {
	const toolName = part.type.replace(/^tool-/, "");
	const state = String(part.state ?? "");
	const input = part.input;
	const output = part.output;

	return (
		<details
			className={`rounded-xl border text-xs ${
				isUser
					? "border-white/30 bg-white/10"
					: "border-edge bg-surface-2"
			}`}
		>
			<summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2">
				<span className="flex items-center gap-1.5">
					<span
						className={`font-mono ${isUser ? "text-white" : "text-brand-strong"}`}
					>
						{toolName}
					</span>
					<span className={isUser ? "text-white/70" : "text-mute"}>
						· {state}
					</span>
				</span>
				<ChevronDown className="h-3 w-3 opacity-70" />
			</summary>
			<div
				className={`space-y-1.5 border-t px-3 py-2 ${
					isUser ? "border-white/20" : "border-edge-soft"
				}`}
			>
				{input !== undefined ? (
					<div>
						<div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
							input
						</div>
						<pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">
							{JSON.stringify(input, null, 2)}
						</pre>
					</div>
				) : null}
				{output !== undefined ? (
					<div>
						<div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
							output
						</div>
						<pre className="overflow-x-auto whitespace-pre-wrap text-[11px]">
							{JSON.stringify(output, null, 2)}
						</pre>
					</div>
				) : null}
			</div>
		</details>
	);
}
