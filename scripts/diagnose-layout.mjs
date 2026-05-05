import { chromium } from "@playwright/test";

const URL = "https://cf_ai_shadow.nikhilsaravanan8.workers.dev/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const haveVitalik = (await page.getByText(/Vitalik/i).count()) > 0;
if (haveVitalik) {
	await page.getByText(/Vitalik/i).first().click();
	await page.waitForTimeout(2000);
}

const data = await page.evaluate(() => {
	const out = {};
	const rect = (el) => {
		const r = el.getBoundingClientRect();
		const cs = getComputedStyle(el);
		return {
			x: r.x,
			y: r.y,
			w: r.width,
			right: r.right,
			scrollW: el.scrollWidth,
			clientW: el.clientWidth,
			gridTpl: cs.gridTemplateColumns,
			minW: cs.minWidth,
			width: cs.width,
			overflow: cs.overflow,
			padding: cs.padding,
			gap: cs.columnGap,
			tag: el.tagName + (el.className ? "." + String(el.className).split(" ").slice(0, 4).join(".") : ""),
		};
	};
	out.viewport = { w: window.innerWidth };
	out.html = rect(document.documentElement);
	out.body = rect(document.body);
	out.root = rect(document.getElementById("root"));
	const main = document.querySelector("main");
	if (main) out.main = rect(main);
	const verticalGrid = main && main.parentElement;
	if (verticalGrid) out.verticalGrid = rect(verticalGrid);
	if (main) {
		out.mainKids = Array.from(main.children).map(rect);
		const dossier = main.children[0];
		const rightRail = main.children[1];
		if (dossier) {
			out.dossier = rect(dossier);
			out.dossierKids = Array.from(dossier.children).slice(0, 5).map(rect);
			const stats = dossier.children[0];
			if (stats) {
				out.statRow = rect(stats);
				out.statCards = Array.from(stats.children).map(rect);
			}
			const activities = Array.from(dossier.children).find((c) =>
				c.textContent && c.textContent.includes("Latest Activities"),
			);
			if (activities) {
				out.activities = rect(activities);
				const tbl = activities.querySelector("table");
				if (tbl) out.activitiesTable = rect(tbl);
			}
		}
		if (rightRail) {
			out.rightRail = rect(rightRail);
			out.rightRailKids = Array.from(rightRail.children).map(rect);
		}
	}
	return out;
});
console.log(JSON.stringify(data, null, 2));

await browser.close();
