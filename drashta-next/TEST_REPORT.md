# Test report (actually executed 2026-10-24)

## 1. Unit/integration tests - `node --test test/*.test.mjs` (Node v22.22.2, AI provider MOCKED)
```
# tests 49
# pass 49
# fail 0
# skipped 0
```
    ✔ welcome message is exact and session starts without server state
    ✔ full flow: data collection -> confirm -> D1 chart -> topic menu; chart returned for UI
    ✔ validation messages and corrections without re-entering everything
    ✔ ambiguous DST time rejected in flow
    ✔ topics: career/marriage cite verified records; finance/spiritual do not fabricate
    ✔ session continuity: follow-up keeps topic; restart resets
    ✔ tampered / garbage / oversized input rejected
    ✔ missing SESSION_SECRET in production -> clear 503, not a blank failure
    ✔ rate limiting
    ✔ config reports demo mode without API key
    ✔ [mocked AI] live response is labelled AI-generated and prompt excludes secrets
    ✔ [mocked AI] provider failure -> safe fallback, rule output kept, key not leaked, error logged
    ✔ [mocked AI] provider HTTP error and timeout handled
    ✔ admin disabled without ADMIN_PASSWORD; endpoints require auth
    ✔ admin: wrong password 401, rate limit 429, correct login sets HttpOnly SameSite cookie
    ✔ admin: cookie alone is not enough (CSRF header required); forged cookie rejected
    ✔ admin: settings validation + effect on welcome/topics; unknown/invalid rejected
    ✔ admin: toggle record affects retrieval and citations; coverage honest
    ✔ admin: knowledge import validates records
    ✔ admin: diagnostics expose status, never secrets
    ✔ no user data is persisted server-side
    ✔ all shipped records are valid, unique, cite source+page+status
    ✔ validator rejects bad records; markdown parser
    ✔ retrieval + record lookup
    ✔ Mercury combustion condition check cites NJK-007 when applicable
    ✔ frontend: every element id used by app.js/admin.js exists in its HTML; no inline scripts (CSP)
    ✔ frontend: error handling present (res.ok check, catch, retry, timeout, typing cleared in finally)
    ✔ frontend: user-controlled deletion and reset exist; DEMO MODE label
    ✔ deploy: Next.js project shape, no Flask/Python leftovers
    ✔ deploy: secrets hygiene (.env.example placeholders only, .gitignore, no secret in client code)
    ✔ JD of J2000
    ✔ Meeus Moon 1992-04-12 (133.167)
    ✔ Meeus Venus 1992-12-20 (313.081)
    ✔ Sun/Moon at J2000
    ✔ parity with Python reference 1947-08-14T18:30:00+00:00
    ✔ parity with Python reference 2000-01-01T12:00:00+00:00
    ✔ parity with Python reference 1985-03-21T03:15:00+00:00
    ✔ parity with Python reference 2020-07-01T06:00:00+00:00
    ✔ parity with Python reference 1960-11-05T22:45:00+00:00
    ✔ parity with Python reference 2026-10-24T05:00:00+00:00
    ✔ parity with Python reference 1900-06-15T08:00:00+00:00
    ✔ regression: 1947 chart signs
    ✔ Mercury retrograde 2020-07-01
    ✔ time: IST 1947 and AM/PM
    ✔ time: DST overlap and gap rejected
    ✔ time: invalid inputs
    ✔ places
    ✔ houses, lords, aspects, dignity, combustion (injected longitudes)
    ✔ D1 only; bad inputs

## 2. Real-browser UI checks - headless Chromium via `scripts/e2e-browser.mjs` (local server, demo mode, no live AI)
```
PASS page renders, status shows online/demo: Online - demo mode
PASS exact welcome message rendered (chat not blank)
PASS quick-reply chip (exact) works
PASS confirm -> D1 chart card rendered
PASS 4 topic buttons: Career | Marriage | Finance | Spiritual Talk: Osho philosophy
PASS topic answer shows cited source record
PASS mobile layout: no horizontal overflow
PASS unreachable server -> visible error + Retry, typing indicator removed
PASS HTML 500 response -> readable error, no blank chat
PASS Retry after recovery works
PASS Delete my session data clears browser storage and returns to welcome
PASS no unexpected JS errors in console
PASS admin: wrong password shows error
PASS admin: login and dashboard loaded (records table, coverage)

14 browser checks passed
```

## 3. NOT run
- `next build` / Vercel deployment (npm registry unreachable here)
- Live Anthropic API calls
- Upstash persistence
- Ephemeris comparison against Swiss Ephemeris/JPL (only Meeus published examples and a Python reference port were used)
- Static deploy-shape tests in the suite check files/config, they are NOT a build.
