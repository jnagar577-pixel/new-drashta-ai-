import test, { beforeEach, afterEach } from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
import * as H from "../lib/handlers.js"; import * as store from "../lib/store.js"; import * as kn from "../lib/knowledge.js"; import { RECORDS } from "../lib/knowledge-data.js";
import { validateRecord, parseMarkdownRecords } from "../lib/validate-record.js"; import * as consult from "../lib/consult.js";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
let n = 0; const fresh = () => `10.0.${Math.floor(n / 250)}.${n++ % 250}`;
const envBackup = { ...process.env };
beforeEach(() => { store.__resetForTests(); for (const k of ["ANTHROPIC_API_KEY","GEMINI_API_KEY","SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL","SUPABASE_ANON_KEY","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_SECRET_KEY","ADMIN_PASSWORD","UPSTASH_REDIS_REST_URL","KV_REST_API_URL","NODE_ENV"]) delete process.env[k]; process.env.SESSION_SECRET = "test-secret-for-drasta-ai-tests-32chars-min"; });
afterEach(() => { globalThis.fetch = realFetch; Object.keys(process.env).forEach(k => { if (!(k in envBackup)) delete process.env[k]; }); Object.assign(process.env, envBackup); });
const realFetch = globalThis.fetch;
const req = (url, method, body, ip, extra = {}) => new Request("http://localhost" + url, { method, headers: { "content-type": "application/json", "x-forwarded-for": ip || fresh(), ...extra }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
const say = async (ip, token, message) => { const r = await H.chat(req("/api/chat", "POST", { token, message }, ip)); return { status: r.status, ...(await r.json()) }; };
async function toMenu(ip = fresh(), who = "Asha") { let r = await say(ip, null, undefined); const t0 = r; let tok = r.token;
  for (const m of [who, "15-08-1947", "New Delhi", "12:00 AM", "exact", "yes"]) { r = await say(ip, tok, m); tok = r.token; } return { r, tok, ip, t0 }; }

test("welcome message is exact and session starts without server state", async () => {
  const r = await say(fresh(), null); assert.equal(r.status, 200); assert.equal(r.reply, "Namaskar, main Drashta AI hoon. Aapka name kya hai?"); assert.ok(r.token); assert.equal(r.mode, "demo");
});
test("full flow: data collection -> confirm -> D1 chart -> topic menu; chart returned for UI", async () => {
  const { r } = await toMenu(); assert.match(r.reply, /D1 \(Lagna\) chart - Lagna: Taurus/); assert.match(r.reply, /1\. Career/); assert.match(r.reply, /4\. Spiritual/);
  assert.equal(r.chart.chart, "D1"); assert.equal(r.choices.length, 4); assert.equal(r.chart.settings.ephemeris_verified, false);
});
test("validation messages and corrections without re-entering everything", async () => {
  const ip = fresh(); let r = await say(ip, null); let tok = r.token;
  r = await say(ip, tok, "12345"); assert.match(r.reply, /naam/); tok = r.token; r = await say(ip, tok, "Asha"); tok = r.token;
  r = await say(ip, tok, "31-02-1990"); assert.match(r.reply, /Date/); tok = r.token; r = await say(ip, tok, "15-08-1947"); tok = r.token;
  r = await say(ip, tok, "Atlantis"); assert.match(r.reply, /offline table/); tok = r.token; r = await say(ip, tok, "Bhopal"); tok = r.token;
  r = await say(ip, tok, "10:30"); assert.match(r.reply, /AM\/PM/); tok = r.token; r = await say(ip, tok, "10:30 PM"); tok = r.token; r = await say(ip, tok, "approximate"); tok = r.token;
  assert.match(r.reply, /Please confirm:\nName: Asha/); r = await say(ip, tok, "no"); tok = r.token; assert.deepEqual(r.choices.map(c => c.value), ["name", "date of birth", "place", "time"]);
  r = await say(ip, tok, "place"); tok = r.token; r = await say(ip, tok, "Delhi"); tok = r.token;
  assert.match(r.reply, /Birthplace: Delhi/); assert.match(r.reply, /Name: Asha/); assert.match(r.reply, /Date of birth: 1947-08-15/); // earlier answers retained
  r = await say(ip, tok, "yes"); assert.match(r.reply, /Approximate time/); assert.match(r.reply, /D1 \(Lagna\)/);
});
test("ambiguous DST time rejected in flow", async () => { const ip = fresh(); let r = await say(ip, null), tok = r.token;
  for (const m of ["Bob", "05-11-2023", "40.7,-74.0,America/New_York"]) { r = await say(ip, tok, m); tok = r.token; } r = await say(ip, tok, "1:30 AM"); assert.match(r.reply, /daylight/); });
test("topics: career/marriage cite verified records; finance/spiritual do not fabricate", async () => {
  const { tok, ip } = await toMenu(); let r = await say(ip, tok, "1"); assert.match(r.reply, /DRASHTA-BNN-004/); assert.match(r.reply, /p\. iii/); assert.match(r.reply, /INFERENCE/); assert.match(r.reply, /Saturn is in/);
  r = await say(ip, r.token, "2"); assert.match(r.reply, /Venus is in/); r = await say(ip, r.token, "3"); assert.match(r.reply, /NO VERIFIED SOURCE RULE/); r = await say(ip, r.token, "4"); assert.match(r.reply, /NO VERIFIED OSHO RECORDS/);
});
test("session continuity: follow-up keeps topic; restart resets", async () => {
  const { tok, ip } = await toMenu(); let r = await say(ip, tok, "2"); r = await say(ip, r.token, "what about it?"); assert.match(r.reply, /Knowledge retrieval mode/); assert.match(r.reply, /marriage/i);
  r = await say(ip, r.token, "restart"); assert.equal(r.reply, "Namaskar, main Drashta AI hoon. Aapka name kya hai?");
});
test("tampered / garbage / oversized input rejected", async () => {
  const { tok, ip } = await toMenu(); const bad = tok.slice(0, -3) + "AAA"; let r = await say(ip, bad, "1"); assert.equal(r.status, 400); assert.equal(r.code, "bad_session");
  assert.equal((await say(ip, "zzz", "1")).status, 400); assert.equal((await say(ip, tok, "x".repeat(501))).status, 400); assert.equal((await say(ip, tok, "")).status, 400);
  const res = await H.chat(req("/api/chat", "POST", "not json{", ip)); assert.equal(res.status, 200); // no token => start session
});

test("short SESSION_SECRET is rejected in production", async () => {
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = "short-secret";
  const r = await say(fresh(), null);
  assert.equal(r.status, 503);
  assert.equal(r.code, "not_configured");
  const c = await (await H.config(req("/api/config", "GET"))).json();
  assert.equal(c.ready, false);
  assert.ok(c.issues.some(i => /32 characters/.test(i)));
});

test("missing SESSION_SECRET in production -> clear 503, not a blank failure", async () => {
  delete process.env.SESSION_SECRET; process.env.NODE_ENV = "production"; const r = await say(fresh(), null); assert.equal(r.status, 503); assert.equal(r.code, "not_configured");
  const c = await (await H.config(req("/api/config", "GET"))).json(); assert.equal(c.ready, false); assert.ok(c.issues.some(i => /SESSION_SECRET/.test(i)));
});
test("rate limiting", async () => { const ip = "9.9.9.9"; let last; for (let i = 0; i < 41; i++) last = await say(ip, null); assert.equal(last.status, 429); });
test("config reports demo mode without API key", async () => { const c = await (await H.config(req("/api/config", "GET"))).json(); assert.equal(c.mode, "demo"); assert.equal(c.topics.length, 4); assert.ok(c.issues.some(i => /demo mode/.test(i))); });

test("[mocked AI] live response is labelled AI-generated and prompt excludes secrets", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-test-key"; let seen;
  globalThis.fetch = async (url, o) => { seen = { url, o }; return new Response(JSON.stringify({ content: [{ type: "text", text: "hello reading" }] }), { status: 200 }); };
  const { tok, ip } = await toMenu(); const r = await say(ip, tok, "1"); assert.match(r.reply, /AI-generated by claude-sonnet-5-5/); assert.equal(r.mode, "live");
  assert.equal(seen.url, "https://api.anthropic.com/v1/messages"); assert.equal(JSON.parse(seen.o.body).model, "claude-sonnet-5-5"); assert.ok(!JSON.parse(seen.o.body).system.includes("sk-test-key"));
});
test("[mocked AI] provider failure -> safe fallback, rule output kept, key not leaked, error logged", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-secret-abc"; globalThis.fetch = async () => { throw new Error("boom sk-secret-abc"); };
  const { tok, ip } = await toMenu(); const r = await say(ip, tok, "1"); assert.match(r.reply, /Live model unavailable/); assert.match(r.reply, /DRASHTA-BNN-004/); assert.ok(!JSON.stringify(r).includes("sk-secret-abc"));
  assert.ok(store.getEvents().some(e => /LLM provider failure/.test(e.msg)) && !JSON.stringify(store.getEvents()).includes("sk-secret-abc"));
});
test("[mocked AI] provider HTTP error and timeout handled", async () => {
  process.env.ANTHROPIC_API_KEY = "k"; globalThis.fetch = async () => new Response("{}", { status: 529 }); const { tok, ip } = await toMenu();
  assert.match((await say(ip, tok, "1")).reply, /Live model unavailable/);
});

// ---- admin ----
const adm = (url, method, body, cookie, ip) => req(url, method, body, ip, { "x-requested-with": "drashta", ...(cookie ? { cookie } : {}) });
async function login(pw = "pw-admin", ip) { const res = await H.adminLogin(req("/api/admin/login", "POST", { password: pw }, ip)); return { res, cookie: (res.headers.get("set-cookie") || "").split(";")[0] }; }
test("admin disabled without ADMIN_PASSWORD; endpoints require auth", async () => {
  assert.equal((await H.adminLogin(req("/x", "POST", { password: "" }))).status, 403);
  process.env.ADMIN_PASSWORD = "pw-admin";
  for (const f of [H.adminSettings, H.adminKnowledge, H.adminDiagnostics]) assert.equal((await f(adm("/x", "GET"))).status, 401);
});
test("admin: wrong password 401, rate limit 429, correct login sets HttpOnly SameSite cookie", async () => {
  process.env.ADMIN_PASSWORD = "pw-admin"; const ip = "8.8.8.8"; assert.equal((await login("bad", ip)).res.status, 401); for (let i = 0; i < 5; i++) await login("bad", ip); assert.equal((await login("bad", ip)).res.status, 429);
  const ok = await login("pw-admin"); assert.equal(ok.res.status, 200); const sc = ok.res.headers.get("set-cookie"); assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Strict/);
});
test("admin: cookie alone is not enough (CSRF header required); forged cookie rejected", async () => {
  process.env.ADMIN_PASSWORD = "pw-admin"; const { cookie } = await login();
  assert.equal((await H.adminSettings(req("/x", "GET", undefined, fresh(), { cookie }))).status, 401);
  assert.equal((await H.adminSettings(adm("/x", "GET", undefined, "drashta_admin=forged.value"))).status, 401);
  assert.equal((await H.adminSettings(adm("/x", "GET", undefined, cookie))).status, 200);
});
test("admin: settings validation + effect on welcome/topics; unknown/invalid rejected", async () => {
  process.env.ADMIN_PASSWORD = "pw-admin"; const { cookie } = await login(); const put = b => H.adminSettings(adm("/x", "PUT", b, cookie));
  assert.equal((await put({ welcome: "Namaste" })).status, 200); assert.equal((await say(fresh(), null)).reply, "Namaste");
  for (const b of [{ provider: "evil" }, { model: "x y!" }, { topics_enabled: ["hack"] }, { ayanamsha: "xyz" }, { assistant_name: "" }, { welcome: "w".repeat(301) }]) assert.equal((await put(b)).status, 400, JSON.stringify(b));
  await put({ welcome: "Namaskar, main Drashta AI hoon. Aapka name kya hai?", topics_enabled: ["career"] }); const { tok, ip } = await toMenu(); assert.match((await say(ip, tok, "3")).reply, /disabled/);
  const s = await (await put({})).json(); assert.equal(s.api_key_configured, false); assert.ok(!JSON.stringify(s).includes("pw-admin"));
});
test("admin: toggle record affects retrieval and citations; coverage honest", async () => {
  process.env.ADMIN_PASSWORD = "pw-admin"; const { cookie } = await login(); const k = () => H.adminKnowledge(adm("/x", "GET", undefined, cookie)).then(r => r.json());
  let d = await k(); assert.ok(d.records.length >= 16); assert.equal(d.coverage["BPHS-GDP"].records, 0); assert.match(d.coverage["OSHO-ASTRO"].status, /NOT SUPPLIED/);
  assert.equal((await H.adminKnowledge(adm("/x", "POST", { toggle: "DRASHTA-BNN-004" }, cookie))).status, 200); assert.equal((await kn.getRecord("DRASHTA-BNN-004")), null);
  const { tok, ip } = await toMenu(); { const rep = (await say(ip, tok, "1")).reply; assert.match(rep, /No active source rule/); assert.ok(!rep.includes("DRASHTA-BNN-004") && !rep.includes("Saturn is in")); }
  assert.equal((await H.adminKnowledge(adm("/x", "POST", { toggle: "NOPE" }, cookie))).status, 404);
});
test("admin: knowledge import validates records", async () => {
  process.env.ADMIN_PASSWORD = "pw-admin"; const { cookie } = await login(); const good = { ...RECORDS[0], id: "TEST-IMPORT-1" }, bad = { id: "X", pillar: "p" }, dup = { ...RECORDS[0] };
  const r = await (await H.adminKnowledge(adm("/x", "POST", { import: [good, bad, dup, "str"] }, cookie))).json(); assert.equal(r.imported, 1); assert.equal(r.errors.length, 3); assert.equal(r.persistent, false);
  assert.ok((await kn.allRecords()).some(x => x.id === "TEST-IMPORT-1"));
});
test("admin: diagnostics expose status, never secrets", async () => {
  process.env.ADMIN_PASSWORD = "pw-admin"; process.env.ANTHROPIC_API_KEY = "sk-zzz"; const { cookie } = await login();
  const t = await (await H.adminDiagnostics(adm("/x", "GET", undefined, cookie))).text(); assert.ok(!t.includes("sk-zzz") && !t.includes("pw-admin") && !t.includes("test-secret-123")); assert.match(t, /NOT verified/);
});
test("no user data is persisted server-side", async () => { await toMenu(); const dump = JSON.stringify([await store.getSettings(), [...(await store.getDisabled())], await store.getExtra(), store.getEvents()]); assert.ok(!/Asha|1947|Delhi/.test(dump)); });

test("DOB parser accepts weekday annotations; time parser supports explicit 24-hour clock", () => {
  assert.equal(consult.parseDate("22 / 07 / 2005 / DAY SHUKRAVAR /"), "2005-07-22");
  assert.deepEqual(consult.parseTime("13:30"), [1,30,"PM"]); assert.deepEqual(consult.parseTime("00:15"), [12,15,"AM"]);
  assert.equal(consult.parseTime("10:30"), null); assert.deepEqual(consult.parseTime("1:30 PM"), [1,30,"PM"]);
});
test("Rajgarh Madhya Pradesh resolves to India timezone without manual coordinates", async () => {
  const { resolvePlace } = await import("../lib/places.js");
  assert.equal(resolvePlace("RAJGARH MADHYA PRADESH").tz, "Asia/Kolkata");
  assert.equal(resolvePlace("Rajgarh MP").name, "Rajgarh Mp");
});
test("new account and database APIs are present and server-side Supabase key is never in browser files", () => {
  for (const f of ["app/api/auth/signup/route.js","app/api/auth/login/route.js","app/api/user/history/route.js","app/api/admin/database/route.js","lib/supabase.js"]) assert.ok(fs.existsSync(path.join(root,f)),f);
  assert.match(read("lib/supabase.js"), /SUPABASE_SERVICE_ROLE_KEY/);
  for (const f of ["public/app.js","public/index.html","public/admin.js","public/admin.html"]) assert.ok(!read(f).includes("SUPABASE_SERVICE_ROLE_KEY"),f);
});

// ---- knowledge pipeline ----
test("app_settings table persists owner settings when Supabase is configured", async () => {
  process.env.SUPABASE_URL="https://example.supabase.co"; process.env.SUPABASE_ANON_KEY="test-anon"; process.env.SUPABASE_SERVICE_ROLE_KEY="test-service-role";
  const values={};
  globalThis.fetch=async (url,opts={})=>{ const u=new URL(String(url));
    if(u.pathname.endsWith("/rest/v1/app_settings") && opts.method==="POST") { const b=JSON.parse(opts.body); values[b.key]=b.value; return new Response(null,{status:204}); }
    if(u.pathname.endsWith("/rest/v1/app_settings")) { const key=(u.searchParams.get("key")||"").replace(/^eq\./,""); return new Response(JSON.stringify(Object.hasOwn(values,key)?[{value:values[key]}]:[]),{status:200}); }
    throw new Error("Unexpected mocked settings request");
  };
  await store.patchSettings({assistant_name:"Drashta Persistent"});
  assert.equal((await store.getSettings()).assistant_name,"Drashta Persistent");
  assert.ok(Object.hasOwn(values,"drashta:settings"));
});

test("signed-in chat creates a Supabase session and persists user/assistant messages", async () => {
  process.env.SUPABASE_URL="https://example.supabase.co"; process.env.SUPABASE_ANON_KEY="test-anon"; process.env.SUPABASE_SERVICE_ROLE_KEY="test-service-role";
  const sid="11111111-1111-4111-8111-111111111111", uid="22222222-2222-4222-8222-222222222222"; const saved=[];
  globalThis.fetch=async (url,opts={})=>{
    const u=String(url);
    if(u.includes("/auth/v1/user")) return new Response(JSON.stringify({id:uid,email:"user@example.com"}),{status:200});
    if(u.includes("/rest/v1/chat_sessions") && opts.method==="POST") return new Response(JSON.stringify([{id:sid,title:"New Chat",created_at:"2026-10-24T00:00:00Z"}]),{status:201});
    if(u.includes("/rest/v1/chat_sessions") && opts.method==="PATCH") return new Response(null,{status:204});
    if(u.includes("/rest/v1/chat_sessions")) return new Response(JSON.stringify([{id:sid,title:"New Chat",created_at:"2026-10-24T00:00:00Z"}]),{status:200});
    if(u.includes("/rest/v1/chat_messages") && opts.method==="POST") { saved.push(JSON.parse(opts.body)); return new Response(JSON.stringify([{}]),{status:201}); }
    throw new Error("Unexpected mocked Supabase request: "+u);
  };
  const first=await H.chat(req("/api/chat","POST",{token:null,authToken:"fake-user-token"})); const f=await first.json(); assert.equal(f.sessionId,sid); assert.equal(f.persistence,true);
  const next=await H.chat(req("/api/chat","POST",{token:f.token,authToken:"fake-user-token",sessionId:sid,message:"Jatin Nagar"})); const n=await next.json();
  assert.equal(next.status,200); assert.equal(n.persistence,true); assert.equal(saved.length,2); assert.equal(saved[0].role,"user"); assert.equal(saved[0].content,"Jatin Nagar"); assert.equal(saved[1].role,"assistant");
});

test("all shipped records are valid, unique, cite source+page+status", () => {
  const ids = new Set(); for (const r of RECORDS) { assert.deepEqual(validateRecord(r), [], r.id); assert.ok(!ids.has(r.id)); ids.add(r.id); }
  assert.ok(RECORDS.length >= 16); assert.ok(!RECORDS.some(r => /BPHS|OSHO/.test(r.source_id)), "no unsourced BPHS/Osho records may exist yet");
});
test("validator rejects bad records; markdown parser", () => {
  assert.ok(validateRecord({ id: "ab" }).length); assert.ok(validateRecord({ ...RECORDS[0], verification_status: "trust-me" }).some(e => /verification_status/.test(e)));
  assert.equal(parseMarkdownRecords("x\n```yaml\nid: A-1\nfoo: bar\n```\n").length, 1);
});
test("retrieval + record lookup", async () => { assert.ok((await kn.search("Saturn profession karaka")).some(r => r.id === "DRASHTA-BNN-004")); assert.equal((await kn.getRecord("DRASHTA-NJK-007")).printed_page, "11"); assert.deepEqual(await kn.search("zzzzqqq"), []); });
test("Mercury combustion condition check cites NJK-007 when applicable", async () => {
  const st = consult.newState(); Object.assign(st.d, { name: "T", dob: "1990-07-20", place: { name: "Delhi", lat: 28.61, lon: 77.2, tz: "Asia/Kolkata" }, time: [6, 0, "AM"], exact: true }); st.step = "confirm";
  const r = await consult.handle(st, "yes", { cfg: await store.getSettings(), records: await kn.activeRecords() }); assert.match(r.reply, /D1 \(Lagna\)/);
});

// ---- frontend wiring + deploy compatibility (static checks, NOT a real build) ----
const read = p => fs.readFileSync(path.join(root, p), "utf8");
test("frontend: every element id used by app.js/admin.js exists in its HTML; no inline scripts (CSP)", () => {
  for (const [js, html] of [["public/app.js", "public/index.html"], ["public/admin.js", "public/admin.html"]]) {
    const ids = [...read(js).matchAll(/\$\("([\w-]+)"\)/g)].map(m => m[1]); const h = read(html);
    for (const id of new Set(ids)) if (id !== "typing") assert.match(h, new RegExp(`id="${id}"`), `${html} missing #${id}`);
    assert.ok(!/<script(?![^>]*src=)/i.test(h) && !/\son\w+=/.test(h)); }
});
test("frontend: error handling present (res.ok check, catch, retry, timeout, typing cleared in finally)", () => {
  const a = read("public/app.js"); for (const s of ["!res.ok", "catch (e)", "Retry", "AbortController", "finally", "typing(false)", "Cannot reach the server", "bad_session"]) assert.ok(a.includes(s), s);
});
test("frontend: user-controlled deletion and reset exist; DEMO MODE label", () => { const h = read("public/index.html"), a = read("public/app.js"); assert.match(h, /End session/); assert.match(h, /New chat/); assert.match(a, /DEMO MODE/); assert.ok(a.includes("sessionStorage.removeItem")); });
test("deploy: Next.js project shape, no Flask/Python leftovers", () => {
  const pkg = JSON.parse(read("package.json")); assert.ok(pkg.dependencies.next && pkg.dependencies.react && pkg.dependencies["react-dom"]); assert.match(pkg.scripts.build, /next build/); assert.equal(pkg.type, "module");
  for (const f of ["requirements.txt", "app.py", "index.py", "server.py", "wsgi.py", "api/index.py", "drashta"]) assert.ok(!fs.existsSync(path.join(root, f)), f + " must not exist");
  if (fs.existsSync(path.join(root, "vercel.json"))) assert.ok(!/python|flask/i.test(read("vercel.json")));
  for (const r of ["config", "chat", "admin/login", "admin/logout", "admin/settings", "admin/knowledge", "admin/diagnostics", "admin/database", "auth/login", "auth/signup", "auth/logout", "user/history"]) { const s = read(`app/api/${r}/route.js`); assert.match(s, /export (?:const (?:GET|POST|PUT)|async function (?:GET|POST|PUT))/); assert.match(s, /runtime = "nodejs"/); }
  assert.ok(fs.existsSync(path.join(root, "public/index.html")) && fs.existsSync(path.join(root, "app/layout.js"))); assert.match(read("next.config.mjs"), /destination: "\/index\.html"/);
});
test("deploy: secrets hygiene (.env.example placeholders only, .gitignore, no secret in client code)", () => {
  const env = read(".env.example"); assert.ok(!/sk-[A-Za-z0-9]{10,}/.test(env)); for (const k of ["SESSION_SECRET", "ADMIN_PASSWORD", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "UPSTASH_REDIS_REST_URL"]) assert.ok(env.includes(k + "="));
  const gi = read(".gitignore"); for (const s of [".env", "node_modules", ".next", ".vercel"]) assert.ok(gi.includes(s), s);
  for (const f of ["public/app.js", "public/admin.js", "public/index.html", "public/admin.html"]) assert.ok(!/ANTHROPIC_API_KEY|ADMIN_PASSWORD|SESSION_SECRET/.test(read(f)), f);
});
