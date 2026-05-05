import { chromium } from "@playwright/test";

const URL = "https://cf_ai_shadow.nikhilsaravanan8.workers.dev/";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push({ kind: "pageerror", text: err.message }));
page.on("console", (msg) => {
	const t = msg.type();
	if (t === "error" || t === "warning") errors.push({ kind: t, text: msg.text() });
});
page.on("requestfailed", (req) =>
	errors.push({ kind: "requestfailed", text: `${req.method()} ${req.url()} — ${req.failure()?.errorText}` }),
);
page.on("response", async (res) => {
	if (res.status() >= 400) {
		errors.push({ kind: "http", text: `${res.status()} ${res.request().method()} ${res.url()}` });
	}
});
page.on("websocket", (ws) => {
	console.log("[ws-open]", ws.url());
	ws.on("framesent", (f) =>
		console.log("[ws-tx]", typeof f.payload === "string" ? f.payload.slice(0, 200) : "<binary>"),
	);
	ws.on("framereceived", (f) =>
		console.log("[ws-rx]", typeof f.payload === "string" ? f.payload.slice(0, 200) : "<binary>"),
	);
	ws.on("close", () => console.log("[ws-close]", ws.url()));
});

console.log("→ load");
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

// Confirm watchlist + select Vitalik (already added)
const haveVitalik = (await page.getByText(/Vitalik/i).count()) > 0;
console.log("haveVitalik:", haveVitalik);
if (haveVitalik) {
	await page.getByText(/Vitalik/i).first().click();
	await page.waitForTimeout(1500);
}

// Layout: log bounding rects so we can see what's cut off
const layout = await page.evaluate(() => {
	const out = {};
	const sel = (q) => {
		const el = document.querySelector(q);
		return el ? el.getBoundingClientRect() : null;
	};
	out.viewport = { w: window.innerWidth, h: window.innerHeight };
	out.documentScroll = {
		w: document.documentElement.scrollWidth,
		h: document.documentElement.scrollHeight,
	};
	out.main = sel("main");
	out.aside = sel('aside[class*="glass"]');
	out.rightRail = (() => {
		const all = Array.from(document.querySelectorAll("section, aside, div"));
		const r = all.find((e) => e.className && /minmax\(0,1fr\)_360px/.test(e.className));
		return r ? r.getBoundingClientRect() : null;
	})();
	return out;
});
console.log("layout:", JSON.stringify(layout, null, 2));

// Window screenshot (what user sees)
console.log("→ screenshot window");
await page.screenshot({ path: "/tmp/probe-window.png", fullPage: false });

// Full page (sees overflow)
console.log("→ screenshot fullPage");
await page.screenshot({ path: "/tmp/probe-full.png", fullPage: true });

// Try sending a chat message
console.log("→ try chat");
const chatInput = page.locator('input[placeholder="ask shadow…"]');
await chatInput.fill("list my watchlist");
await page.locator('button[aria-label="Send"]').click();

// Wait up to 30s for any response or error
const start = Date.now();
let gotResponse = false;
while (Date.now() - start < 30_000) {
	const assistantCount = await page.locator('li[data-role="assistant"]').count();
	if (assistantCount > 0) {
		gotResponse = true;
		break;
	}
	await page.waitForTimeout(1000);
}
console.log("gotResponse:", gotResponse, "elapsed:", Math.round((Date.now() - start) / 1000), "s");
await page.waitForTimeout(2000);

console.log("→ screenshot post-chat");
await page.screenshot({ path: "/tmp/probe-chat.png", fullPage: false });

console.log("\n--- errors ---");
for (const e of errors) console.log(`[${e.kind}]`, e.text);

await browser.close();
