# Migration from the Flask version

| Old (Flask, deleted) | Why it failed / what replaced it |
|---|---|
| `drashta/app.py` (`create_app()` factory) | Vercel's Flask detector needs a top-level `app.py`/`index.py`/`server.py` exposing a module-level `app`; there was none -> `FLASK_ENTRYPOINT_NOT_FOUND`. Replaced by Next.js route handlers in `app/api/**` (re-exporting `lib/handlers.js`). |
| SQLite file `data/drashta.db` | Vercel serverless filesystem is read-only/ephemeral, so session creation failed -> blank chat. Replaced by **stateless signed session tokens** (`lib/session.js`); no user data is stored server-side. Owner settings use Upstash Redis when configured (`lib/store.js`). |
| `drashta/templates/*.html` | Static `public/index.html`, `public/admin.html` + `styles.css`, `app.js`, `admin.js`. Old JS had no `res.ok`/`catch` handling, which hid failures as an empty chat; the new client shows every error with Retry. |
| `drashta/chart.py` | Ported to `lib/chart.js`; verified against Python reference output on 7 charts (`test/fixtures/parity.json`). Still the **approximate** analytic ephemeris, not Swiss Ephemeris. |
| `drashta/consult.py`, `kb.py`, `llm.py`, `places.py` | `lib/consult.js`, `lib/knowledge.js` + `scripts/ingest.mjs`, `lib/llm.js`, `lib/places.js`. |
| `knowledge/*.md` records | Kept unchanged (16 records incl. new `DRASHTA-NJK-007`); ingested to `lib/knowledge-data.js`. |
| `requirements.txt`, Python tests | Removed. Tests are now `node:test`. |

## Steps in your GitHub repo
1. Delete: `drashta/`, `requirements.txt`, `tests/` (old), and any `vercel.json`, `app.py`, `index.py`, `server.py`, `api/*.py`, `pyproject.toml` that contain Flask/Python build settings.
2. Copy this project's contents so that **`package.json` is at the repository root** (or keep a subfolder and set Vercel's Root Directory to it).
3. `npm install`, then commit the generated `package-lock.json` (it could not be generated in the build environment).
4. In Vercel: Settings -> General -> Framework Preset **Next.js**; clear any custom Build/Output/Install command overrides left from the Flask attempt.
