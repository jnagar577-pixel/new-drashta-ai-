// Safe environment preflight. Reports presence/format only, never values.
const prod = process.env.NODE_ENV === "production";
const secret = process.env.SESSION_SECRET || "";
const checks = [
  ["SESSION_SECRET", secret.length >= 32, "required in production; use at least 32 random characters"],
  ["ADMIN_PASSWORD", (process.env.ADMIN_PASSWORD || "").length >= 12, "required to enable /admin; use a unique password of 12+ characters"],
  ["ANTHROPIC_API_KEY", !!process.env.ANTHROPIC_API_KEY, "optional; absent means rule-based DEMO MODE"],
  ["UPSTASH_REDIS_REST_URL + token", !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) || !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN), "optional for persistent owner settings; otherwise serverless memory is not persistent"],
];
let failed = false;
console.log(`Drashta AI environment preflight (${prod ? "production" : "development"})`);
for (const [name, ok, note] of checks) {
  const status = ok ? "OK" : (name === "ANTHROPIC_API_KEY" || name.startsWith("UPSTASH") ? "OPTIONAL/MISSING" : "MISSING/INVALID");
  console.log(`${status.padEnd(17)} ${name}: ${note}`);
  if (!ok && (name === "SESSION_SECRET" || name === "ADMIN_PASSWORD") && prod) failed = true;
}
if (prod && secret.length < 32) {
  console.error("Production is not ready: SESSION_SECRET must contain at least 32 characters.");
}
if (failed) process.exitCode = 1;
