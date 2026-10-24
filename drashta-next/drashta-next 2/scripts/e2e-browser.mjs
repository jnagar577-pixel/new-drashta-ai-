// OPTIONAL real-browser check (needs puppeteer + Chromium; not a project dependency). Usage:
//   PUPPETEER_FROM=/path/to/package.json CHROME_PATH=/path/to/chrome node scripts/e2e-browser.mjs
import { createRequire } from "node:module"; import assert from "node:assert/strict"; import fs from "node:fs";
import { createServer } from "./local-server.mjs";
process.env.SESSION_SECRET ||= "e2e-secret"; process.env.ADMIN_PASSWORD ||= "e2e-admin"; delete process.env.ANTHROPIC_API_KEY;
const puppeteer = createRequire(process.env.PUPPETEER_FROM || import.meta.url)("puppeteer");
const srv = createServer(); await new Promise(r => srv.listen(0, r)); const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox"] }); const results = [];
const ok = (name) => { results.push(name); console.log("PASS", name); };
const botTexts = p => p.$$eval("#log .msg.bot", els => els.map(e => e.textContent));
const waitBot = (p, n) => p.waitForFunction(c => document.querySelectorAll("#log .msg.bot").length >= c && !document.getElementById("typing"), { timeout: 8000 }, n);
async function sendText(p, text, n) { await p.type("#input", text); await p.click("#send"); await waitBot(p, n); }
try {
  const page = await browser.newPage(); const pageErrors = []; page.on("pageerror", e => pageErrors.push(e.message)); page.on("console", m => m.type() === "error" && pageErrors.push(m.text()));
  await page.setViewport({ width: 1100, height: 800 }); await page.goto(base); await page.waitForFunction(() => /Online/.test(document.getElementById("status").textContent));
  ok("page renders, status shows online/demo: " + await page.$eval("#status", e => e.textContent));
  await page.screenshot({ path: "/tmp/shot-welcome.png" });
  await page.click("#begin"); await waitBot(page, 1); assert.equal((await botTexts(page))[0], "Namaskar, main Drashta AI hoon. Aapka name kya hai?"); ok("exact welcome message rendered (chat not blank)");
  let n = 1; for (const m of ["Asha", "15-08-1947", "New Delhi", "12:00 AM"]) { await sendText(page, m, ++n); }
  await page.waitForSelector("#chips button"); await page.click("#chips button"); await waitBot(page, ++n); ok("quick-reply chip (exact) works");
  await page.click("#chips button"); await waitBot(page, ++n); await page.waitForSelector("details.chart"); ok("confirm -> D1 chart card rendered");
  const cards = await page.$$eval("#chips button", b => b.map(x => x.textContent)); assert.equal(cards.length, 4); ok("4 topic buttons: " + cards.join(" | "));
  await page.click("#chips button"); await waitBot(page, ++n); assert.match((await botTexts(page)).at(-1), /DRASHTA-BNN-004/); ok("topic answer shows cited source record");
  await page.screenshot({ path: "/tmp/shot-chat.png" });
  await page.setViewport({ width: 390, height: 780 }); await page.screenshot({ path: "/tmp/shot-mobile.png" }); const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); assert.ok(!overflow); ok("mobile layout: no horizontal overflow");
  // failure 1: server unreachable
  await page.setRequestInterception(true); const mode = { v: "abort" }; page.on("request", r => r.url().includes("/api/chat") ? (mode.v === "abort" ? r.abort("connectionrefused") : mode.v === "500" ? r.respond({ status: 500, contentType: "text/html", body: "<h1>boom</h1>" }) : r.continue()) : r.continue());
  await page.type("#input", "hello"); await page.click("#send"); await page.waitForSelector(".msg.err"); assert.equal(await page.$("#typing"), null); assert.ok(await page.$eval(".msg.err", e => /Cannot reach/.test(e.textContent))); ok("unreachable server -> visible error + Retry, typing indicator removed");
  // failure 2: HTML 500 page
  await page.$eval(".msg.err", e => e.remove()); mode.v = "500"; await page.type("#input", "hello"); await page.click("#send"); await page.waitForSelector(".msg.err"); assert.match(await page.$eval(".msg.err", e => e.textContent), /Server error \(500\)/); ok("HTML 500 response -> readable error, no blank chat");
  // retry succeeds
  mode.v = "pass"; await page.click(".msg.err button"); await waitBot(page, ++n); ok("Retry after recovery works");
  // delete data
  await page.click("#wipe"); assert.equal(await page.evaluate(() => sessionStorage.getItem("drashta_session_v2")), null); assert.ok(await page.$eval("#welcome", e => !e.classList.contains("hidden"))); ok("Delete my session data clears browser storage and returns to welcome");
  assert.deepEqual(pageErrors.filter(e => !/Failed to load resource|ERR_|status of 500/.test(e)), []); ok("no unexpected JS errors in console");
  // admin
  const a = await browser.newPage(); await a.setViewport({ width: 1100, height: 900 }); await a.goto(base + "/admin"); await a.type("#pw", "wrong"); await a.click("#go"); await a.waitForFunction(() => /Wrong password/.test(document.getElementById("msg").textContent)); ok("admin: wrong password shows error");
  await a.$eval("#pw", e => e.value = ""); await a.type("#pw", process.env.ADMIN_PASSWORD); await a.click("#go"); await a.waitForSelector("#panel:not(.hidden)"); await a.waitForSelector("#recs tr:nth-child(5)"); ok("admin: login and dashboard loaded (records table, coverage)");
  await a.screenshot({ path: "/tmp/shot-admin.png", fullPage: false });
  console.log(`\n${results.length} browser checks passed`);
} finally { await browser.close(); srv.close(); }
