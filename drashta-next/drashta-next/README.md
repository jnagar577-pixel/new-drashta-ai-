# Drashta AI (v2, Next.js on Vercel)

Drashta AI is a Next.js consultation app with a D1 chart engine, source-aware knowledge retrieval, optional live model providers, Supabase Auth and database persistence for signed-in chats, and an admin-only Secret Database panel. It still labels the analytic ephemeris as approximate. No Python or Flask. **Read "Status & limitations" first.**

## Layout
```
app/api/**/route.js   thin Next.js route handlers (config, chat, admin/*)  ->  lib/handlers.js
lib/chart.js          deterministic D1 engine (approximate ephemeris)       lib/consult.js   conversation + rule evaluation
lib/session.js        signed chat-state tokens                               lib/supabase.js  server-only Supabase Auth/REST adapter
lib/store.js          owner settings/record toggles (Upstash or memory)
lib/knowledge*.js     records + retrieval + coverage                         lib/llm.js             server-side Anthropic/Gemini adapters
knowledge/*.md        source-attributed records  --scripts/ingest.mjs-->  lib/knowledge-data.js (validated)
public/               index.html, admin.html, app.js, admin.js, styles.css  (HTML/CSS/JS UI, no framework needed)
test/                 node:test suites     scripts/local-server.mjs  run without Next     scripts/e2e-browser.mjs  optional Chromium check
```

## Run locally
```
npm run local            # no install needed: http://localhost:3000  (admin: /admin) - uses env vars below
npm install && npm run dev    # the real Next.js dev server (not verified in the build environment)
npm test                 # ingest + Node tests (Node >= 20, built-in test runner)
npm run check:env        # safe environment preflight; never prints secret values
```
Set env vars (copy `.env.example`): `SESSION_SECRET` (required), `ADMIN_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), and one model key (`ANTHROPIC_API_KEY` or `GEMINI_API_KEY`) for live AI. Existing Vercel Supabase integration may already provide the Supabase values. Read `SUPABASE_SETUP.md`. Without a model key the UI must remain in **DEMO MODE**; Supabase alone is storage/auth, not an AI model. If `SESSION_SECRET` is missing in production the UI shows "Server not configured" instead of failing silently.

## Deploy: GitHub -> Vercel (exact steps)
1. Follow `MIGRATION.md` so the repo root contains `package.json`, `app/`, `lib/`, `public/`, `next.config.mjs` and **no** Flask/Python files.
2. Locally: `npm install && npm run build && npm test`. Commit `package-lock.json`. Push to GitHub.
3. vercel.com -> **Add New -> Project** -> import the repo. Framework Preset: **Next.js**. Root Directory: the folder holding `package.json`. Leave Build/Install/Output overrides **off** (`npm run build` runs ingest then `next build`).
4. Project -> Settings -> Environment Variables (Production and Preview): `SESSION_SECRET` (random 32+ bytes), `ADMIN_PASSWORD`, the three Supabase server/auth variables and one model key if live AI is wanted. Never put the service-role key in a `NEXT_PUBLIC_` variable. Optional persistence for owner settings: Marketplace -> **Upstash Redis**.
5. Deploy. Check `https://<your-domain>/api/config` -> `"ready": true`, then open `/` and `/admin`. If you front the site with Cloudflare, do not cache `/api/*`; this project is built for Vercel and was not tested on Cloudflare Pages/Workers.

## Status & limitations (honest)
See `AUDIT_AND_NEXT_STEPS.md` and `SUPABASE_SETUP.md` for integration details. Supabase Auth, profiles, saved chat sessions/messages, approved knowledge retrieval and app_settings persistence are implemented in this package, but require a live Preview deployment test.
**Verified here:** 55 Node tests pass, including DOB/time/place regressions, route-shape checks and secret-hygiene checks. AI calls are mocked in tests. JS chart engine matches the Python reference on 7 charts.
**NOT verified:** `next build`/Vercel deployment, live Supabase calls, real Anthropic/Gemini API calls, or production authentication end-to-end. The build environment has no installed Next.js dependency and no network access, so deploy this ZIP to a preview and test before promoting it.
**Approximate:** ephemeris is a low-precision analytic model (planets ~0.02-0.1 deg, Moon up to ~0.3 deg), reported in every chart as unverified; nakshatra/pada/sign-edge results can be wrong. Swiss Ephemeris was not integrated (no installable package offline; note its AGPL/commercial licence). Aspect, dignity and combustion orbs are external conventions.
**Knowledge:** 20 local records: BNN-RGR intro (9), NADI-JK (7), plus 4 original Drashta spiritual reflections. The 4 reflections are explicitly marked unverified synthesis, not direct Osho quotations. BPHS has no verified operational rules yet because the supplied scan needs page-by-page transcription. Approved Supabase `knowledge_records` are retrieved alongside local records. No web research was done (no network). Source rules identify which planet to examine, not outcomes, so the app predicts no outcomes.
**Not built:** full Parashari yoga/dasha/transit engine, Swiss Ephemeris, verified full-book BPHS/Osho coverage, and production-tested cross-instance rate limiting. Place matching is still an offline table plus manual coordinates.
**Privacy:** signed-in profiles, chat sessions and messages are stored in Supabase; guest chart state remains in browser sessionStorage. The chart token is signed, not encrypted. Never log request bodies or expose service-role keys. Admin database access is protected by the admin password/cookie. Live AI still requires a valid model-provider API key.
