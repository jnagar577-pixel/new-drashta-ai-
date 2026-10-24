// Persistence for OWNER settings/record toggles only. No user/session data is ever stored server-side.
// Uses Upstash Redis REST (Vercel Marketplace "Upstash Redis"/KV) when env vars exist; otherwise in-memory (NOT persistent on serverless).
export const DEFAULTS = { assistant_name: "Drashta AI", welcome: "Namaskar, main Drashta AI hoon. Aapka name kya hai?",
  instructions: "Use only the supplied chart data and cited source records. Never invent placements or citations. Do not make deterministic or frightening predictions.",
  provider: "anthropic", model: "claude-sonnet-5-5", ayanamsha: "lahiri", topics_enabled: ["career","marriage","finance","spiritual"] };
let mem = { settings: {}, disabled: [], extra: [] }; const events = [];
const remote = () => { const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN; return url && token ? { url, token } : null; };
export const storeKind = () => remote() ? "upstash-redis (persistent)" : "memory (NOT persistent across serverless invocations)";
async function cmd(c) { const r = remote(); const res = await fetch(r.url, { method: "POST", headers: { Authorization: `Bearer ${r.token}`, "Content-Type": "application/json" }, body: JSON.stringify(c), signal: AbortSignal.timeout(5000) }); if (!res.ok) throw new Error("store unavailable"); return (await res.json()).result; }
async function load(k, fb) { if (!remote()) return mem[k] ?? fb; const v = await cmd(["GET", "drashta:" + k]); return v ? JSON.parse(v) : fb; }
async function save(k, v) { if (!remote()) { mem[k] = v; return; } await cmd(["SET", "drashta:" + k, JSON.stringify(v)]); }
export function logEvent(level, msg) { events.unshift({ ts: new Date().toISOString(), level, msg: String(msg).slice(0, 300) }); events.length = Math.min(events.length, 100); }
export const getEvents = () => events.slice();
export async function getSettings() { try { return { ...DEFAULTS, ...(await load("settings", {})) }; } catch (e) { logEvent("error", "settings store read failed"); return { ...DEFAULTS }; } }
export async function patchSettings(p) { const cur = await load("settings", {}); await save("settings", { ...cur, ...p }); return getSettings(); }
export async function getDisabled() { try { return new Set(await load("disabled", [])); } catch { logEvent("error", "disabled-list read failed"); return new Set(); } }
export async function toggleRecord(id) { const s = await getDisabled(); s.has(id) ? s.delete(id) : s.add(id); await save("disabled", [...s]); return s.has(id); }
export async function getExtra() { try { return await load("extra", []); } catch { return []; } }
export async function saveExtra(list) { await save("extra", list); }
export function __resetForTests() { mem = { settings: {}, disabled: [], extra: [] }; events.length = 0; }
