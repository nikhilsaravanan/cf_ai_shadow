import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages } from "ai";

const SHADOW_SYSTEM_PROMPT_M1 =
  "You are Shadow, an AI research assistant that helps users understand DeFi wallets on Ethereum mainnet. " +
  "The tool surface for querying wallets is still being built; answer general questions helpfully and, " +
  "when asked about a specific wallet, say that wallet-lookup tools will be wired up in a later milestone.";

export class ChatAgent extends AIChatAgent<Env> {
  async onChatMessage() {
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
      system: SHADOW_SYSTEM_PROMPT_M1,
      messages: await convertToModelMessages(this.messages),
    });

    return result.toUIMessageStreamResponse();
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
