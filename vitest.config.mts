import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		// Playwright e2e specs live under test/e2e and are run by `npm run test:e2e`,
		// not by vitest. Loading them here would try to import @playwright/test inside
		// the Workers runtime, which doesn't have node:child_process.
		exclude: ["**/node_modules/**", "test/e2e/**"],
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
			},
		},
	},
});
