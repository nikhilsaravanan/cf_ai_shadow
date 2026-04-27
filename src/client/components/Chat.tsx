import { useState, type FormEvent } from "react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { ArrowUp, MessageSquare, ChevronDown } from "lucide-react";

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
		<aside className="flex h-full min-h-0 flex-col rounded-2xl border border-edge bg-surface">
			<div className="flex items-start justify-between border-b border-edge/60 px-5 py-4">
				<div className="min-w-0">
					<h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-zinc-100">
						<MessageSquare className="h-4 w-4 text-brand" strokeWidth={2.5} />
						Chat
					</h2>
					{selected ? (
						<p className="mt-1 truncate font-mono text-[11px] text-zinc-500">
							{selected.slice(0, 10)}…{selected.slice(-6)}
						</p>
					) : (
						<p className="mt-1 text-[11px] text-zinc-500">
							Ask Shadow about any wallet on your watchlist.
						</p>
					)}
				</div>
			</div>

			<ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
				{chat.messages.length === 0 ? (
					<li className="rounded-xl border border-dashed border-edge bg-canvas/50 p-3 text-xs text-zinc-500">
						Try{" "}
						<span className="text-zinc-300">"summarize my watchlist"</span> or{" "}
						<span className="text-zinc-300">"tell me about this wallet"</span>.
					</li>
				) : (
					chat.messages.map((m) => <MessageBubble key={m.id} message={m} />)
				)}
				{chat.isStreaming ? (
					<li className="flex items-center gap-1.5 px-2 text-[11px] text-zinc-500">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
						streaming…
					</li>
				) : null}
			</ul>

			<form onSubmit={onSubmit} className="border-t border-edge/60 p-3">
				<div className="flex items-center gap-2 rounded-full border border-edge bg-canvas pl-4 pr-1.5 py-1.5 transition focus-within:border-brand/60">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="ask shadow…"
						className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
					/>
					<button
						type="submit"
						disabled={chat.isStreaming || !input.trim()}
						aria-label="Send"
						className="grid h-8 w-8 place-items-center rounded-full bg-brand text-canvas transition hover:bg-brand-hover disabled:opacity-40"
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
				className={`max-w-[85%] space-y-1.5 rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
					isUser
						? "bg-brand text-canvas"
						: "border border-edge bg-canvas text-zinc-100"
				}`}
			>
				{message.parts.map((part, i) => {
					if (part.type === "text") {
						return (
							<p key={i} className="whitespace-pre-wrap leading-relaxed">
								{String(part.text ?? "")}
							</p>
						);
					}
					if (part.type.startsWith("tool-")) {
						return <ToolCard key={i} part={part} />;
					}
					return null;
				})}
			</div>
		</li>
	);
}

function ToolCard({ part }: { part: { type: string } & Record<string, unknown> }) {
	const toolName = part.type.replace(/^tool-/, "");
	const state = String(part.state ?? "");
	const input = part.input;
	const output = part.output;

	return (
		<details className="rounded-xl border border-edge bg-surface-2/60 text-xs">
			<summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-zinc-300">
				<span className="flex items-center gap-1.5">
					<span className="font-mono text-brand">{toolName}</span>
					<span className="text-zinc-500">· {state}</span>
				</span>
				<ChevronDown className="h-3 w-3 text-zinc-500" />
			</summary>
			<div className="space-y-1.5 border-t border-edge/60 px-3 py-2">
				{input !== undefined ? (
					<div>
						<div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
							input
						</div>
						<pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-zinc-300">
							{JSON.stringify(input, null, 2)}
						</pre>
					</div>
				) : null}
				{output !== undefined ? (
					<div>
						<div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
							output
						</div>
						<pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-zinc-300">
							{JSON.stringify(output, null, 2)}
						</pre>
					</div>
				) : null}
			</div>
		</details>
	);
}
