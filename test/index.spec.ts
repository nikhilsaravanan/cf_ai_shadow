import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/server";

describe("Worker entrypoint", () => {
	it("falls through routeAgentRequest to 404 for non-agent paths (unit style)", async () => {
		const request = new Request("http://example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
		expect(await response.text()).toMatchInlineSnapshot(`"Not found"`);
	});

	it("serves the SPA shell at / through the assets binding (integration style)", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toContain('<div id="root"');
		expect(body).toContain("Shadow");
	});
});
