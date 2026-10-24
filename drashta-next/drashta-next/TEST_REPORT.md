# Drashta AI test report

Updated: 24 October 2026

## Automated tests

Command: `npm test`

Result: **55 passed, 0 failed**. The built-in Node test runner covers:

- Date parsing including dates with weekday annotations.
- Time parsing with AM/PM and explicit 24-hour values; ambiguous values without AM/PM are rejected.
- Rajgarh, Madhya Pradesh place resolution and Asia/Kolkata timezone.
- D1 chart regression/parity fixtures and timezone/DST edge cases.
- Conversation flow, validation, citations and honest limitations.
- Mocked AI provider success/failure, timeout handling and secret redaction.
- Admin auth checks, record validation and source coverage.
- Mocked Supabase app_settings persistence and signed-in chat persistence, presence of Supabase auth/history/admin routes, and no service-role key in browser assets.
- Frontend element IDs, error handling, CSP compatibility and deploy structure.

## Not verified in this environment

- `next build` and a real Vercel deployment. Next.js dependencies are not installed in this isolated workspace, and the environment has no network access for installation.
- Real Supabase sign-up/sign-in, PostgREST inserts, RLS/service-role behavior or real chat-history persistence. The routes are implemented but must be verified in the connected Supabase project after deployment.
- Live Anthropic or Gemini API responses. Provider behavior is unit-tested with mocked HTTP responses only.
- Production security review, load testing or multi-instance rate limiting.

## Known product limitations

- The chart engine remains an approximate analytic ephemeris and D1-only. It is not Swiss Ephemeris and should not be described as astronomically authoritative.
- The supplied BPHS and Osho PDF text extraction needs source/page verification. The four new spiritual records are original Drashta reflections, marked as unverified synthesis, and are not direct Osho quotations.
- Guest chats are not saved to Supabase. Signed-in chats are designed to persist in `chat_sessions` and `chat_messages`.
- Live model mode requires a valid Anthropic or Gemini API key in Vercel. Supabase alone does not supply a language model.
