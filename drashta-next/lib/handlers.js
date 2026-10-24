// Web-standard request handlers (Request -> Response). Thin Next.js route files re-export these.
import crypto from "node:crypto";
import * as consult from "./consult.js"; import * as llm from "./llm.js"; import * as store from "./store.js"; import * as kn from "./knowledge.js";
import { sign, verify, secret } from "./session.js"; import { validateRecord } from "./validate-record.js";
const json = (b, status = 200, headers = {}) => Response.json(b, { status, headers: { "Cache-Control": "no-store", ...headers } });
const ip = req => (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
const hits = new Map();
export function limited(key, n, perMs) { const now = Date.now(), q = (hits.get(key) || []).filter(t => t > now - perMs); if (q.length >= n) { hits.set(key, q); return true; } q.push(now); hits.set(key, q); if (hits.size > 5000) hits.clear(); return false; }
const body = async req => { try { const b = await req.json(); return b && typeof b === "object" ? b : {}; } catch { return {}; } };
const wrap = fn => async req => { try { return await fn(req); } catch (e) { store.logEvent("error", `${req.method} ${new URL(req.url).pathname}: ${e.name}: ${String(e.message).slice(0, 100)}`); return json({ error: "Something went wrong on the server. Please try again.", code: "server_error" }, 500); } };
const issues = () => [!secret() && "SESSION_SECRET is not set - chat is disabled until it is configured", !process.env.ANTHROPIC_API_KEY && "No ANTHROPIC_API_KEY: running in demo mode (rule-based, no AI model)"].filter(Boolean);

export const config = wrap(async () => { const s = await store.getSettings();
  return json({ name: s.assistant_name, mode: llm.isLive(s) ? "live" : "demo", ready: !!secret(), issues: issues(), topics: s.topics_enabled.map(t => ({ id: t, label: consult.LABEL[t] })), ephemeris_verified: false }); });

export const chat = wrap(async req => {
  if (limited("chat:" + ip(req), 40, 60000)) return json({ error: "Too many requests. Please wait a minute.", code: "rate_limited" }, 429);
  if (!secret()) return json({ error: "Server is not configured (SESSION_SECRET missing).", code: "not_configured" }, 503);
  const b = await body(req), cfg = await store.getSettings(), mode = llm.isLive(cfg) ? "live" : "demo";
  if (b.token == null) { const st = consult.newState(); return json({ token: sign({ st }, 6 * 3600), reply: cfg.welcome, choices: [], mode }); }
  const sess = verify(b.token); if (!sess) return json({ error: "Your session expired or is invalid. Please restart.", code: "bad_session" }, 400);
  if (typeof b.message !== "string" || !b.message.trim() || b.message.length > 500) return json({ error: "Message must be 1-500 characters.", code: "bad_input" }, 400);
  const records = await kn.activeRecords(), r = await consult.handle(sess.st, b.message, { cfg, records });
  return json({ token: sign({ st: r.state }, 6 * 3600), reply: r.reply, choices: r.choices, chart: r.chart, mode });
});

// ---- admin ----
const adminPw = () => process.env.ADMIN_PASSWORD || "";
const sha = s => crypto.createHash("sha256").update(String(s)).digest();
const cookieOf = (req, n) => (req.headers.get("cookie") || "").split(/;\s*/).map(c => c.split("=")).find(c => c[0] === n)?.[1];
function need(req) {
  if (!adminPw()) return json({ error: "Admin disabled: set ADMIN_PASSWORD", code: "admin_disabled" }, 403);
  if (req.headers.get("x-requested-with") !== "drashta" || !verify(cookieOf(req, "drashta_admin"))?.admin) return json({ error: "Unauthorized", code: "unauthorized" }, 401);
  return null;
}
export const adminLogin = wrap(async req => {
  if (!adminPw()) return json({ error: "Admin disabled: set ADMIN_PASSWORD", code: "admin_disabled" }, 403);
  if (!secret()) return json({ error: "SESSION_SECRET missing", code: "not_configured" }, 503);
  if (limited("login:" + ip(req), 5, 300000)) return json({ error: "Too many attempts. Try again in 5 minutes.", code: "rate_limited" }, 429);
  const b = await body(req); if (!crypto.timingSafeEqual(sha(b.password ?? ""), sha(adminPw()))) return json({ error: "Wrong password", code: "unauthorized" }, 401);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return json({ ok: true }, 200, { "Set-Cookie": `drashta_admin=${sign({ admin: true }, 4 * 3600)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=14400${secure}` });
});
export const adminLogout = wrap(async () => json({ ok: true }, 200, { "Set-Cookie": "drashta_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" }));
const TOPIC_IDS = Object.values(consult.TOPICS);
export const adminSettings = wrap(async req => {
  const denied = need(req); if (denied) return denied;
  if (req.method === "PUT") { const b = await body(req), p = {}, bad = m => json({ error: m, code: "bad_input" }, 400);
    if ("assistant_name" in b) { if (typeof b.assistant_name !== "string" || !b.assistant_name.trim() || b.assistant_name.length > 60) return bad("assistant_name: 1-60 chars"); p.assistant_name = b.assistant_name.trim(); }
    if ("welcome" in b) { if (typeof b.welcome !== "string" || !b.welcome.trim() || b.welcome.length > 300) return bad("welcome: 1-300 chars"); p.welcome = b.welcome; }
    if ("instructions" in b) { if (typeof b.instructions !== "string" || b.instructions.length > 2000) return bad("instructions: max 2000 chars"); p.instructions = b.instructions; }
    if ("provider" in b) { if (!["anthropic", "demo"].includes(b.provider)) return bad("provider must be anthropic or demo"); p.provider = b.provider; }
    if ("model" in b) { if (typeof b.model !== "string" || !/^[\w.\-:]{3,80}$/.test(b.model)) return bad("model: invalid id"); p.model = b.model; }
    if ("ayanamsha" in b) { if (!(b.ayanamsha === "lahiri" || /^custom:-?\d+(\.\d+)?$/.test(b.ayanamsha))) return bad("ayanamsha: lahiri or custom:<deg>"); p.ayanamsha = b.ayanamsha; }
    if ("topics_enabled" in b) { if (!Array.isArray(b.topics_enabled) || !b.topics_enabled.every(t => TOPIC_IDS.includes(t))) return bad("topics_enabled: invalid"); p.topics_enabled = b.topics_enabled; }
    await store.patchSettings(p); }
  return json({ ...(await store.getSettings()), api_key_configured: !!process.env.ANTHROPIC_API_KEY, store: store.storeKind() });
});
export const adminKnowledge = wrap(async req => {
  const denied = need(req); if (denied) return denied;
  if (req.method === "POST") { const b = await body(req);
    if (typeof b.toggle === "string") { const all = await kn.allRecords(); if (!all.some(r => r.id === b.toggle)) return json({ error: "Unknown record id", code: "bad_input" }, 404); return json({ id: b.toggle, disabled: await store.toggleRecord(b.toggle) }); }
    if (Array.isArray(b.import)) { const extra = await store.getExtra(), have = new Set((await kn.allRecords()).map(r => r.id)), errors = []; let n = 0;
      for (const r of b.import.slice(0, 200)) { const e = validateRecord(r); if (!e.length && have.has(r.id)) e.push("duplicate id"); if (e.length) errors.push(`${r?.id ?? "?"}: ${e.join("; ")}`); else { extra.push({ ...r, _file: "import" }); have.add(r.id); n++; } }
      if (n) await store.saveExtra(extra); return json({ imported: n, errors, persistent: store.storeKind().startsWith("upstash") }); }
    return json({ error: "Expected {toggle:id} or {import:[...]}", code: "bad_input" }, 400); }
  const dis = await store.getDisabled();
  return json({ records: (await kn.allRecords()).map(r => ({ id: r.id, source: r.source_id, page: r.printed_page, verification: r.verification_status, summary: r.source_supported_summary.slice(0, 160), enabled: !dis.has(r.id) })), coverage: await kn.coverage() });
});
export const adminDiagnostics = wrap(async req => { const denied = need(req); if (denied) return denied;
  return json({ node: process.version, store: store.storeKind(), session_secret: !!secret(), admin_password: !!adminPw(), anthropic_key: !!process.env.ANTHROPIC_API_KEY,
    ephemeris: "approximate analytic model - NOT verified/authoritative", events: store.getEvents(), data_retention: "No user or session data is stored on the server; birth details live in the user's browser session only." }); });
