import { chromium } from "@playwright/test";

const URL = "https://cf_ai_shadow.nikhilsaravanan8.workers.dev/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let textDeltas = 0;
let toolCalls = 0;
const frames = [];
page.on("websocket", (ws) => {
	if (!ws.url().includes("researcher")) return;
	ws.on("framereceived", (f) => {
		const s = typeof f.payload === "string" ? f.payload : "";
		if (s.includes("text-delta")) textDeltas++;
		if (s.includes("tool-input-start")) toolCalls++;
		if (s.includes("cf_agent_use_chat_response") || s.includes('"type":"error"')) {
			frames.push(s.slice(0, 500));
		}
	});
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
await page.getByText(/Vitalik/i).first().click();
await page.waitForTimeout(1500);

// send a fresh, clear question
await page.locator('input[placeholder="ask shadow…"]').fill(
	"summarize the vitalik wallet on my watchlist",
);
await page.locator('button[aria-label="Send"]').click();

// wait up to 60s for at least one text-delta
const start = Date.now();
while (Date.now() - start < 60_000) {
	if (textDeltas > 0) break;
	await page.waitForTimeout(1000);
}
const elapsed = Math.round((Date.now() - start) / 1000);
console.log(`textDeltas=${textDeltas} toolCalls=${toolCalls} elapsed=${elapsed}s`);
console.log("frames received:", frames.length);
for (const f of frames) console.log(" ", f);

// take a final screenshot
await page.waitForTimeout(3000);
await page.screenshot({ path: "/tmp/chat-final.png", fullPage: false });

await browser.close();
