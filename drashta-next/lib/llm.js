// Server-side provider adapter. Only Anthropic is implemented. Returns null in demo mode. NOT verified against the live API.
export class LLMError extends Error {}
export const isLive = cfg => cfg.provider === "anthropic" && !!process.env.ANTHROPIC_API_KEY;
export async function generate(cfg, system, messages, maxTokens = 900) {
  if (!isLive(cfg)) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: AbortSignal.timeout(25000),
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, messages }) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json(); return (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  } catch (e) { throw new LLMError(e.name === "TimeoutError" ? "timeout" : String(e.message).replace(/sk-[\w-]+/g, "***").slice(0, 80)); }
}
