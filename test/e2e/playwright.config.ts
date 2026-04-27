import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: ".",
	timeout: 90_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [["list"]],
	use: {
		baseURL: "http://localhost:5173",
		trace: "retain-on-failure",
		viewport: { width: 1400, height: 900 },
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
