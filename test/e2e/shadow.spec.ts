import { test, expect, type Page } from "@playwright/test";

const TEST_WALLET = "0x28C6c06298d514Db089934071355E5743bf21d60"; // Binance 14 hot wallet (high traffic, well-known label)
const TEST_LABEL = "Binance 14";

async function gotoApp(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
	});
	await page.goto("/", { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Shadow" })).toBeVisible();
	return errors;
}

test.describe("Shadow three-panel UI", () => {
	test("loads the app shell with Watchlist / Dossier / Chat", async ({ page }) => {
		const errors = await gotoApp(page);
		await expect(page.getByRole("heading", { name: "Watchlist" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Chat" })).toBeVisible();
		// Dossier empty-state message (we haven't selected a wallet yet)
		await expect(
			page.getByText("Select a wallet from the watchlist."),
		).toBeVisible();
		// Tagline
		await expect(
			page.getByText("DeFi wallet research — Ethereum mainnet"),
		).toBeVisible();
		expect(errors, `unexpected page errors: ${errors.join("\n")}`).toEqual([]);
	});

	test("rejects malformed address with inline error", async ({ page }) => {
		await gotoApp(page);
		await page.getByPlaceholder("0x…").fill("not-an-address");
		await page.getByRole("button", { name: /Add wallet/i }).click();
		await expect(
			page.getByText("address must be 0x-prefixed, 40 hex chars"),
		).toBeVisible();
	});

	test("adds a wallet, selects it, and renders the Dossier panel", async ({
		page,
	}) => {
		const errors = await gotoApp(page);

		await page.getByPlaceholder("0x…").fill(TEST_WALLET);
		await page.getByPlaceholder("label (optional)").fill(TEST_LABEL);
		await page.getByRole("button", { name: /Add wallet/i }).click();

		// Watchlist should now show the truncated address + label.
		// Scope to the Watchlist <aside> — the same address also renders in the Chat header.
		const watchlist = page
			.locator("aside")
			.filter({ has: page.getByRole("heading", { name: "Watchlist" }) });
		const truncated = `${TEST_WALLET.slice(0, 10)}…${TEST_WALLET.slice(-6)}`;
		await expect(
			watchlist.getByText(truncated.toLowerCase()),
		).toBeVisible();
		await expect(watchlist.getByText(TEST_LABEL)).toBeVisible();

		// Dossier panel should mount and show the full lowercased address
		await expect(
			page.locator("h2.font-mono", { hasText: TEST_WALLET.toLowerCase() }),
		).toBeVisible();
		// Refresh button is the proof the dossier panel mounted
		await expect(
			page.getByRole("button", { name: "Refresh" }),
		).toBeVisible();

		expect(errors, `unexpected page errors: ${errors.join("\n")}`).toEqual([]);
	});

	test("Refresh button kicks off ingestion and dossier narrative renders", async ({
		page,
	}) => {
		await gotoApp(page);

		// Click the existing watchlist entry from the previous test
		const truncated = `${TEST_WALLET.slice(0, 10)}…${TEST_WALLET.slice(-6)}`;
		await page.getByText(truncated).first().click();
		await expect(
			page.locator("h2.font-mono", { hasText: TEST_WALLET.toLowerCase() }),
		).toBeVisible();

		await page.getByRole("button", { name: "Refresh" }).click();

		// AI-dependent strict assertion: narrative paragraph renders AND has
		// non-trivial content. The narrative <p> (data-testid=dossier-narrative)
		// only mounts when dossier.version > 0 (i.e. summarizeDossier returned a
		// parsed object).
		const narrative = page.getByTestId("dossier-narrative");
		await expect(narrative).toBeVisible({ timeout: 90_000 });
		await expect.poll(
			async () => ((await narrative.textContent()) ?? "").trim().length,
			{ timeout: 30_000 },
		).toBeGreaterThan(40);

		// At least one strategy tag should render in the yellow Strategy card
		// (rendered as <li> rows inside the brand-yellow card).
		const strategyCard = page.locator(
			"div.bg-brand:has(h3:text-is('Strategy'))",
		);
		await expect(strategyCard).toBeVisible();
		const tagItems = strategyCard.locator("ul > li");
		await expect(tagItems.first()).toBeVisible();
		expect(await tagItems.count()).toBeGreaterThan(0);
	});

	test("chat panel: user bubble + assistant reply streams back", async ({
		page,
	}) => {
		await gotoApp(page);

		// Unique per run — chat history persists in the DO across runs.
		const msg = `e2e ping ${Date.now()} — list my watched wallets`;
		const input = page.getByPlaceholder("ask shadow…");
		await input.fill(msg);
		await page.getByRole("button", { name: "Send" }).click();

		// User bubble appears
		await expect(page.getByText(msg)).toBeVisible();

		// AI-dependent strict assertion: an assistant bubble (li[data-role!=user])
		// appears with non-empty text within 60s.
		const assistantBubble = page.locator(
			'li[data-role="assistant"]',
		);
		await expect(assistantBubble.first()).toBeVisible({ timeout: 60_000 });
		await expect.poll(
			async () =>
				((await assistantBubble.first().textContent()) ?? "").trim().length,
			{ timeout: 30_000 },
		).toBeGreaterThan(0);

		// Streaming indicator, if it appeared, should eventually disappear.
		await expect(page.getByText("streaming…")).toHaveCount(0, {
			timeout: 60_000,
		});
	});

	test("removes a wallet via hover-revealed remove button", async ({ page }) => {
		await gotoApp(page);

		const truncated = `${TEST_WALLET.slice(0, 10)}…${TEST_WALLET.slice(-6)}`;
		const row = page.locator("li", { hasText: truncated }).first();
		await row.hover();
		await row.getByRole("button", { name: "remove" }).click();

		// Our test wallet's row is gone, and the dossier returns to placeholder
		const truncatedAfter = `${TEST_WALLET.slice(0, 10)}…${TEST_WALLET.slice(-6)}`;
		await expect(page.getByText(truncatedAfter)).toHaveCount(0);
		await expect(
			page.getByText("Select a wallet from the watchlist."),
		).toBeVisible();
	});
});
