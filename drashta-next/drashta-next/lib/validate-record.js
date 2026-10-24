export const STATUS_PREFIXES = ["source_verified","partially_verified","text_layer_only","external_reference","unverified","ocr_uncertain","pending_source"];
const REQUIRED = ["id","pillar","source_id","source_title","printed_page","source_supported_summary","verification_status"];
export function validateRecord(r) {
  const errs = [];
  if (!r || typeof r !== "object") return ["not an object"];
  for (const k of REQUIRED) if (typeof r[k] !== "string" || !r[k].trim()) errs.push(`missing ${k}`);
  if (typeof r.id === "string" && !/^[A-Za-z0-9_\-]{3,60}$/.test(r.id)) errs.push("bad id format");
  if (typeof r.verification_status === "string" && !STATUS_PREFIXES.some(p => r.verification_status.startsWith(p))) errs.push(`unknown verification_status '${r.verification_status}'`);
  for (const [k,v] of Object.entries(r)) if (typeof v !== "string" || v.length > 4000) errs.push(`field ${k} must be a string <= 4000 chars`);
  return errs;
}
export function parseMarkdownRecords(text) {
  const out = [];
  for (const m of text.matchAll(/```yaml\n([\s\S]*?)```/g)) {
    const r = {};
    for (const line of m[1].split("\n")) { const k = line.match(/^([a-z_]+):\s*(.*)$/); if (k) r[k[1]] = k[2].trim(); }
    if (r.id) out.push(r);
  }
  return out;
}
