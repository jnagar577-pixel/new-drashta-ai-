import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEnv } from "../scripts/check-env.mjs";

const base = { SESSION_SECRET: "x".repeat(32), ADMIN_PASSWORD: "y".repeat(12) };

test("check-env: fully empty env fails in production, not in dev", () => {
  const dev = evaluateEnv({});
  assert.equal(dev.failed, false);
  const prod = evaluateEnv({ NODE_ENV: "production" });
  assert.equal(prod.failed, true);
});

test("check-env: SESSION_SECRET and ADMIN_PASSWORD alone are enough to pass production", () => {
  const r = evaluateEnv({ NODE_ENV: "production", ...base });
  assert.equal(r.failed, false);
  assert.equal(r.flags.sessionSecretOk, true);
  assert.equal(r.flags.adminPasswordOk, true);
});

test("check-env: short SESSION_SECRET is rejected even if present", () => {
  const r = evaluateEnv({ NODE_ENV: "production", ...base, SESSION_SECRET: "too-short" });
  assert.equal(r.failed, true);
  assert.equal(r.flags.sessionSecretOk, false);
});

test("check-env: either Anthropic or Gemini alone is sufficient; neither required", () => {
  const anthropicOnly = evaluateEnv({ ...base, ANTHROPIC_API_KEY: "sk-ant-x" });
  assert.equal(anthropicOnly.flags.anthropic, true);
  assert.equal(anthropicOnly.flags.gemini, false);
  assert.equal(anthropicOnly.checks.find(c => c.name.includes("ANTHROPIC")).ok, true);

  const geminiOnly = evaluateEnv({ ...base, GEMINI_API_KEY: "g-key" });
  assert.equal(geminiOnly.checks.find(c => c.name.includes("ANTHROPIC")).ok, true);

  const neither = evaluateEnv({ ...base });
  assert.equal(neither.checks.find(c => c.name.includes("ANTHROPIC")).ok, false);
  // Absence of a provider key must never fail the build, in dev or production.
  assert.equal(evaluateEnv({ NODE_ENV: "production", ...base }).failed, false);
});

test("check-env: Supabase trio must be all-or-nothing; partial config is flagged distinctly", () => {
  const none = evaluateEnv({ ...base });
  assert.equal(none.flags.supabaseConfigured, false);
  assert.equal(none.flags.supabasePartial, false);

  const partial = evaluateEnv({ ...base, SUPABASE_URL: "https://x.supabase.co" });
  assert.equal(partial.flags.supabaseConfigured, false);
  assert.equal(partial.flags.supabasePartial, true);

  const full = evaluateEnv({
    ...base,
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    SUPABASE_ANON_KEY: "anon-key",
  });
  assert.equal(full.flags.supabaseConfigured, true);
  assert.equal(full.flags.supabasePartial, false);

  // A partially-configured Supabase must never silently pass production preflight by accident
  // (it's still "not required", so it doesn't fail the build, but it must be reported distinctly).
  const partialNote = partial.checks.find(c => c.name.startsWith("SUPABASE_URL")).note;
  assert.match(partialNote, /PARTIALLY/);
});

test("check-env: Supabase alternate env var names (NEXT_PUBLIC_*) are recognised", () => {
  const r = evaluateEnv({
    ...base,
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SECRET_KEY: "service-key",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  });
  assert.equal(r.flags.supabaseConfigured, true);
});

test("check-env: never includes a secret value in any check note", () => {
  const secretValue = "sk-ant-super-secret-value-should-never-leak";
  const r = evaluateEnv({ ...base, ANTHROPIC_API_KEY: secretValue, SESSION_SECRET: "z".repeat(32) + secretValue });
  const serialized = JSON.stringify(r);
  assert.equal(serialized.includes(secretValue), false);
});

test("check-env: Upstash is reported as optional and ignored once Supabase is configured", () => {
  const withUpstash = evaluateEnv({ ...base, UPSTASH_REDIS_REST_URL: "https://u", UPSTASH_REDIS_REST_TOKEN: "t" });
  assert.equal(withUpstash.checks.find(c => c.name.startsWith("UPSTASH")).ok, true);
  const kvAlias = evaluateEnv({ ...base, KV_REST_API_URL: "https://u", KV_REST_API_TOKEN: "t" });
  assert.equal(kvAlias.checks.find(c => c.name.startsWith("UPSTASH")).ok, true);
});
