// Safe environment preflight. Reports presence/format only, NEVER prints a secret value.
// Exported so tests can exercise the logic with a fake env object instead of mutating process.env.

export function evaluateEnv(env = process.env) {
  const prod = env.NODE_ENV === "production";
  const has = v => typeof v === "string" && v.length > 0;

  const sessionSecretOk = has(env.SESSION_SECRET) && env.SESSION_SECRET.length >= 32;
  const adminPasswordOk = has(env.ADMIN_PASSWORD) && env.ADMIN_PASSWORD.length >= 12;

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseService = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
  const supabaseAnon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const supabasePieces = [has(supabaseUrl), has(supabaseService), has(supabaseAnon)];
  const supabaseConfigured = supabasePieces.every(Boolean);
  const supabasePartial = supabasePieces.some(Boolean) && !supabaseConfigured;

  const anthropic = has(env.ANTHROPIC_API_KEY);
  const gemini = has(env.GEMINI_API_KEY);

  const upstashOk = !!((env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL) && (env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN));

  // required: hard-blocks the app itself (chat/admin refuse to run without these).
  // not required: the app degrades gracefully (demo mode / guest-only mode) without these,
  // but they are needed for the live-AI and Supabase-backed features this project asks for.
  const checks = [
    { name: "SESSION_SECRET", ok: sessionSecretOk, required: true,
      note: "32+ random characters. Without it, chat is disabled server-side (not a silent failure)." },
    { name: "ADMIN_PASSWORD", ok: adminPasswordOk, required: true,
      note: "12+ characters recommended. Without it, /admin and the Secret Database panel are disabled." },
    { name: "ANTHROPIC_API_KEY or GEMINI_API_KEY", ok: anthropic || gemini, required: false,
      note: (anthropic || gemini)
        ? `present (${[anthropic && "anthropic", gemini && "gemini"].filter(Boolean).join(" + ")}) \u2014 only one is required, not both`
        : "neither set \u2014 app correctly runs in rule-based DEMO MODE, clearly labelled as such" },
    { name: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY", ok: supabaseConfigured, required: false,
      note: supabaseConfigured
        ? "all three present \u2014 sign-in, saved chat history and the admin Secret Database panel are available"
        : supabasePartial
          ? "PARTIALLY set \u2014 all three are required together; fix before deploying or these features will fail at runtime instead of degrading cleanly"
          : "not set \u2014 app runs guest-only: no sign-in, no saved history, admin Secret Database panel disabled (this is a safe, intentional degradation, not a crash)" },
    { name: "UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_*)", ok: upstashOk, required: false,
      note: upstashOk ? "present \u2014 used only as a fallback if Supabase is not configured" : "optional fallback; ignored entirely once Supabase is configured" },
  ];

  const failed = prod && checks.some(c => c.required && !c.ok);
  return { prod, checks, failed, flags: { supabaseConfigured, supabasePartial, anthropic, gemini, sessionSecretOk, adminPasswordOk } };
}

// CLI entry point \u2014 only runs when this file is executed directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { prod, checks, failed } = evaluateEnv(process.env);
  console.log(`Drashta AI environment preflight (${prod ? "production" : "development"})`);
  for (const c of checks) {
    const status = c.ok ? "OK" : c.required ? "MISSING/INVALID" : "OPTIONAL/MISSING";
    console.log(`${status.padEnd(17)} ${c.name}: ${c.note}`);
  }
  if (failed) {
    console.error("Production is not ready: fix the MISSING/INVALID required variable(s) above (SESSION_SECRET and/or ADMIN_PASSWORD).");
    process.exitCode = 1;
  }
}
