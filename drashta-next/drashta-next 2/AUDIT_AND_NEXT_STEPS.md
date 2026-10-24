# Drashta AI final package audit

## Implemented in this package

- Date parsing accepts DD-MM-YYYY, ISO dates, and date strings with weekday annotations.
- Time parsing accepts explicit AM/PM and unambiguous 24-hour inputs; ambiguous `10:30` is rejected until AM/PM is supplied.
- Added Rajgarh, Rajgarh MP and Rajgarh Madhya Pradesh to the offline birthplace list (approximate coordinates; timezone Asia/Kolkata).
- Added a server-only Supabase REST/Auth adapter using existing environment variables.
- Added email sign-up/sign-in endpoints, profile upsert, account-token verification, signed-in chat-session creation, message persistence and history endpoints.
- Added an admin-only Secret Database panel with User Database, User Chat History and Knowledge Database sections, plus knowledge record submission.
- Approved Supabase `knowledge_records` are added to retrieval; draft/rejected records are not retrieved.
- Added Gemini provider support as an alternative to the existing Anthropic adapter. Live mode still requires a valid provider API key.
- Added four original Drashta spiritual reflection records. They are clearly marked as unverified synthesis, not as direct Osho quotations.
- Updated UI, environment example, setup guide and tests.

## Tests

`npm test`: 53 passed, 0 failed in this workspace.

## Deployment caveats

This ZIP has not been deployed to the live GitHub/Vercel project from this environment. `next build`, real Supabase API calls and real model API calls could not be tested here. Deploy first to a Vercel Preview and verify `/api/config`, email sign-up/sign-in, one saved chat, the admin Secret Database views, and a live model call before promoting it to Production.

## Required environment variables

See `SUPABASE_SETUP.md`. The Supabase service-role key must stay server-side and must never be placed in a `NEXT_PUBLIC_*` variable. A valid model API key is still required for live AI; without it, DEMO MODE is correct and must remain visible.
