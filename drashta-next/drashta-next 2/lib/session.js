// Stateless signed session token: the server stores NOTHING about the user; the browser holds the token.
import crypto from "node:crypto";
const DEV_SECRET = "dev-insecure-secret-do-not-use";
const MIN_SECRET_LENGTH = 32;

// Production secrets must be at least 32 characters. Never silently fall back in production.
export const secret = () => {
  const configured = process.env.SESSION_SECRET;
  if (typeof configured === "string" && configured.length >= MIN_SECRET_LENGTH) return configured;
  return process.env.NODE_ENV === "production" ? null : (configured || DEV_SECRET);
};
const b64 = s => Buffer.from(s).toString("base64url"), sig = (p, k) => crypto.createHmac("sha256", k).update(p).digest("base64url");
export function sign(obj, ttlSec) { const k = secret(); if (!k) throw new Error("SESSION_SECRET not set"); const p = b64(JSON.stringify({ ...obj, exp: Date.now() + ttlSec * 1000 })); return `${p}.${sig(p, k)}`; }
export function verify(tok) {
  const k = secret(); if (!k || typeof tok !== "string" || tok.length > 6000) return null; const [p, s] = tok.split("."); if (!p || !s) return null;
  const a = Buffer.from(sig(p, k)), b = Buffer.from(s); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(p, "base64url").toString()); return o.exp > Date.now() ? o : null; } catch { return null; }
}
