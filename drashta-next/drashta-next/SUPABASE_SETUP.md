# Supabase setup for Drashta AI

This version uses the existing five tables. It does not create a second Supabase project.

## Required Vercel environment variables

Set for **Production and Preview**, then redeploy:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's public/anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service role key. **Never name this `NEXT_PUBLIC_*`, never put it in browser code, and never share it in chat.**
- `SESSION_SECRET`: at least 32 random characters.
- `ADMIN_PASSWORD`: a unique, strong password for `/admin`.
- `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`: required only if you want live model responses. Supabase is not an AI model.

The project URL must point to the project with `profiles`, `chat_sessions`, `chat_messages`, `knowledge_records`, and `app_settings`.

## Authentication

In Supabase Dashboard → Authentication → Providers, enable Email. If email confirmation is enabled, sign-up returns a confirmation notice; the user must confirm the email and then sign in. Signed-in chat sessions/messages are written server-side using the service-role key after the access token is verified with Supabase Auth. Guest sessions are not saved to the database.

## Existing schema expectations

- `profiles.id` references `auth.users.id` and `display_name` is text.
- `chat_sessions.id` is UUID, `user_id` references `auth.users.id`, `title` and `created_at` exist.
- `chat_messages.id` is identity bigint, `session_id` references `chat_sessions.id`, `role` is constrained to `user`/`assistant`, `content` and `created_at` exist.
- `knowledge_records` has `title`, `content`, `category`, `source`, `status`; approved records are eligible for retrieval.
- `app_settings` remains available for future app settings. This code continues to use the existing owner settings adapter for assistant settings.

The app's server uses the service-role key for database operations, so it bypasses RLS. This key must remain server-only. Keep RLS enabled for direct client access. The current app does not expose direct browser database queries.

## Admin panel

Open `/admin` and sign in with `ADMIN_PASSWORD`. The **Secret Database** panel has three views: User Database, User Chat History (including messages), and Knowledge Database. New knowledge starts as Draft by default; only records marked Approved are retrieved by the chat system. Keep this panel private.

## Live model mode

To avoid pretending the rule-based fallback is a real model, the UI keeps its DEMO MODE label unless the configured provider has a key. Choose Anthropic or Gemini in `/admin` after setting the matching key. Test the provider on a Vercel Preview deployment first.
