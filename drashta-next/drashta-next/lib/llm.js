// Server-side model adapters. A configured key is required for live model responses.
export class LLMError extends Error {}
export const isLive = cfg => (cfg.provider === 'anthropic' && !!process.env.ANTHROPIC_API_KEY) || (cfg.provider === 'gemini' && !!process.env.GEMINI_API_KEY);
export async function generate(cfg, system, messages, maxTokens = 900) {
  if (!isLive(cfg)) return null;
  try {
    if (cfg.provider === 'gemini') {
      const model = cfg.model || 'gemini-2.5-flash';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method:'POST', signal:AbortSignal.timeout(25000), headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ systemInstruction:{parts:[{text:system}]}, contents:messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})), generationConfig:{maxOutputTokens:maxTokens,temperature:0.4} })
      });
      if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json();
      return (j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', signal:AbortSignal.timeout(25000),
      headers:{'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},
      body:JSON.stringify({model:cfg.model,max_tokens:maxTokens,system,messages}) });
    if (!r.ok) throw new Error('HTTP '+r.status);
    const j=await r.json(); return (j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  } catch(e) { throw new LLMError(e.name==='TimeoutError'?'timeout':String(e.message).replace(/sk-[\w-]+/g,'***').slice(0,80)); }
}
