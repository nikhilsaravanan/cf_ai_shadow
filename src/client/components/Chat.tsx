import { useState, type FormEvent } from "react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

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
		<aside className="flex h-full min-h-0 flex-col border-l border-zinc-800">
			<div className="border-b border-zinc-800 px-4 py-3">
				<h2 className="text-sm font-semibold text-zinc-200">Chat</h2>
				{selected ? (
					<p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
						{selected.slice(0, 10)}…{selected.slice(-6)}
					</p>
				) : (
					<p className="mt-0.5 text-xs text-zinc-500">
						Ask about the wallet or your watchlist.
					</p>
				)}
			</div>

			<ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
				{chat.messages.length === 0 ? (
					<li className="text-xs text-zinc-500">
						Try: "summarize my watchlist" or "tell me about this wallet".
					</li>
				) : (
					chat.messages.map((m) => <MessageBubble key={m.id} message={m} />)
				)}
				{chat.isStreaming ? (
					<li className="text-xs text-zinc-500">streaming…</li>
				) : null}
			</ul>

			<form onSubmit={onSubmit} className="border-t border-zinc-800 p-3">
				<div className="flex gap-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="ask shadow…"
						className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
					/>
					<button
						type="submit"
						disabled={chat.isStreaming || !input.trim()}
						className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
					>
						Send
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
		<li className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[85%] space-y-1.5 rounded-lg px-3 py-2 text-sm ${
					isUser
						? "bg-emerald-900/40 text-emerald-50"
						: "bg-zinc-900 text-zinc-100"
				}`}
			>
				{message.parts.map((part, i) => {
					if (part.type === "text") {
						return (
							<p key={i} className="whitespace-pre-wrap">
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
		<details className="rounded border border-zinc-700 bg-zinc-950/50 text-xs">
			<summary className="cursor-pointer px-2 py-1 text-zinc-300">
				<span className="font-mono text-emerald-400">{toolName}</span>
				<span className="ml-2 text-zinc-500">{state}</span>
			</summary>
			<div className="space-y-1 border-t border-zinc-800 px-2 py-1">
				{input !== undefined ? (
					<div>
						<div className="text-[10px] uppercase text-zinc-500">input</div>
						<pre className="overflow-x-auto text-[11px] text-zinc-300">
							{JSON.stringify(input, null, 2)}
						</pre>
					</div>
				) : null}
				{output !== undefined ? (
					<div>
						<div className="text-[10px] uppercase text-zinc-500">output</div>
						<pre className="overflow-x-auto text-[11px] text-zinc-300">
							{JSON.stringify(output, null, 2)}
						</pre>
					</div>
				) : null}
			</div>
		</details>
	);
}
