import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/server";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Worker entrypoint", () => {
	it("falls through routeAgentRequest to 404 for non-agent paths (unit style)", async () => {
		const request = new IncomingRequest("http://example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
		expect(await response.text()).toMatchInlineSnapshot(`"Not found"`);
	});

	it("falls through routeAgentRequest to 404 for non-agent paths (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(404);
		expect(await response.text()).toMatchInlineSnapshot(`"Not found"`);
	});
});
