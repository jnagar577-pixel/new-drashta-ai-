# Drashta AI (v2, Next.js on Vercel)

D1/Lagna-only Vedic chart consultation chat with cited Nadi source records, a separate Osho-reflection topic, an owner dashboard,
and a clearly-labelled demo mode. No Python or Flask. **Read "Status & limitations" first.**

## Layout
```
app/api/**/route.js   thin Next.js route handlers (config, chat, admin/*)  ->  lib/handlers.js
lib/chart.js          deterministic D1 engine (approximate ephemeris)       lib/consult.js   conversation + rule evaluation
lib/session.js        signed stateless sessions                              lib/store.js     owner settings (Upstash or memory)
lib/knowledge*.js     records + retrieval + coverage                         lib/llm.js       server-side Anthropic adapter
knowledge/*.md        source-attributed records  --scripts/ingest.mjs-->  lib/knowledge-data.js (validated)
public/               index.html, admin.html, app.js, admin.js, styles.css  (HTML/CSS/JS UI, no framework needed)
test/                 node:test suites     scripts/local-server.mjs  run without Next     scripts/e2e-browser.mjs  optional Chromium check
```

## Run locally
```
npm run local            # no install needed: http://localhost:3000  (admin: /admin) - uses env vars below
npm install && npm run dev    # the real Next.js dev server (not verified in the build environment)
npm test                 # ingest + 49 tests (Node >= 20, built-in test runner)
```
Set env vars (copy `.env.example`): `SESSION_SECRET` (required), `ADMIN_PASSWORD`, optional `ANTHROPIC_API_KEY`, optional Upstash Redis URL/token.
Without `ANTHROPIC_API_KEY` the UI says **DEMO MODE**. If `SESSION_SECRET` is missing in production the UI shows "Server not configured" instead of failing silently.

## Deploy: GitHub -> Vercel (exact steps)
1. Follow `MIGRATION.md` so the repo root contains `package.json`, `app/`, `lib/`, `public/`, `next.config.mjs` and **no** Flask/Python files.
2. Locally: `npm install && npm run build && npm test`. Commit `package-lock.json`. Push to GitHub.
3. vercel.com -> **Add New -> Project** -> import the repo. Framework Preset: **Next.js**. Root Directory: the folder holding `package.json`. Leave Build/Install/Output overrides **off** (`npm run build` runs ingest then `next build`).
4. Project -> Settings -> Environment Variables (Production and Preview): `SESSION_SECRET` (random 32+ bytes), `ADMIN_PASSWORD`, optionally `ANTHROPIC_API_KEY`. Optional persistence: Marketplace -> **Upstash Redis**, which injects `KV_REST_API_URL/TOKEN` (also read) - without it owner settings reset on cold starts.
5. Deploy. Check `https://<your-domain>/api/config` -> `"ready": true`, then open `/` and `/admin`. If you front the site with Cloudflare, do not cache `/api/*`; this project is built for Vercel and was not tested on Cloudflare Pages/Workers.

## Status & limitations (honest)
**Verified here:** 49 unit/integration tests (mocked AI) and 14 real headless-Chromium UI checks pass - see `TEST_REPORT.md`. JS chart engine matches the Python reference on 7 charts.
**NOT verified:** `next build`/Vercel deployment (npm registry unreachable: Next.js was never installed here; the `/`->`/index.html` rewrite and route handlers are standard but untested), live Anthropic calls (mocked only), Upstash adapter (no network), any production deployment.
**Approximate:** ephemeris is a low-precision analytic model (planets ~0.02-0.1 deg, Moon up to ~0.3 deg), reported in every chart as unverified; nakshatra/pada/sign-edge results can be wrong. Swiss Ephemeris was not integrated (no installable package offline; note its AGPL/commercial licence). Aspect, dignity and combustion orbs are external conventions.
**Knowledge:** 16 records: BNN-RGR intro (9; visually verified pp. iii-iv) and NADI-JK (7; pp. 5, 6, 10-11, 33, 40). **None for BPHS or Osho** (BPHS scan has no text layer; Osho PDFs have corrupted Hindi text; the Osho astrology book was not supplied). Finance and Spiritual say so. No web research was done (no network). Source rules identify which planet to examine, not outcomes, so the app predicts no outcomes.
**Not built:** Parashari yoga/dasha/transit engines, progression engine (NJK records exist), gender input, geocoding (offline city table or `lat,lon,Timezone`), non-Anthropic providers, admin record editor/file upload (JSON import only; persists only with Upstash), cross-instance rate limiting (best-effort in-memory).
**Privacy:** no user data on the server; birth details are in a signed token in the browser's sessionStorage (cleared by "Delete my session data" or closing the tab). The token is signed, not encrypted: do not log request bodies.
