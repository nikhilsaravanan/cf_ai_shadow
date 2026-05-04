import { chromium } from "@playwright/test";

const URL = "https://cf_ai_shadow.nikhilsaravanan8.workers.dev/";
const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("console", (msg) => {
	const t = msg.type();
	if (t === "error" || t === "warning") console.log(`[${t}]`, msg.text());
});

console.log("→ load");
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const haveVitalik =
	(await page.getByText(/Vitalik/i).count()) > 0;
if (!haveVitalik) {
	console.log("→ add Vitalik");
	await page.getByRole("button", { name: /Add wallet/i }).click();
	await page.locator('input[placeholder="0x…"]').fill(VITALIK);
	await page.locator('input[placeholder="label (optional)"]').fill("Vitalik");
	await page.getByRole("button", { name: /^Add$/ }).click();
	await page.waitForTimeout(2500);
} else {
	console.log("→ Vitalik already in watchlist, selecting");
	await page.getByText(/Vitalik/i).first().click();
	await page.waitForTimeout(1500);
}

const haveDossier =
	(await page.locator('[data-testid="dossier-narrative"]').count()) > 0;
if (!haveDossier) {
	console.log("→ click Refresh");
	await page.getByRole("button", { name: /Refresh/i }).click();

	console.log("→ wait for dossier (max 180s)");
	const start = Date.now();
	let renderedDossier = false;
	while (Date.now() - start < 180_000) {
		const narrative = await page
			.locator('[data-testid="dossier-narrative"]')
			.count();
		if (narrative > 0) {
			renderedDossier = true;
			break;
		}
		await page.waitForTimeout(2000);
	}
	console.log(
		"renderedDossier:",
		renderedDossier,
		"elapsed:",
		Math.round((Date.now() - start) / 1000),
		"s",
	);
} else {
	console.log("→ dossier already loaded");
}

await page.waitForTimeout(2500);

console.log("→ screenshot");
await page.screenshot({ path: "docs/shadow-prod.png", fullPage: false });

await browser.close();
console.log("done");
