import { RECORDS } from "./knowledge-data.js"; import { getDisabled, getExtra } from "./store.js";
export const SOURCES = {
  "BNN-RGR": { title: "Bhrigu Nandi Nadi - R. G. Rao", tradition: "Bhrigu Nandi Nadi", status: "supplied; OCR text layer; introduction only (pp. iii-iv) extracted; page offset printed = PDF + 5" },
  "NADI-JK": { title: "Nadi Jyotish Bhag 1 (Hindi) - Jitender Kumar", tradition: "Nadi (secondary author's own research)", status: "supplied; Hindi text layer corrupted; 7 records (pp. 5, 6, 10-11, 33, 40)" },
  "BPHS-GDP": { title: "Brihat Parashar Hora Shastra - Ganesh Datt Pathak ed.", tradition: "Parashari", status: "supplied; 810-page image-only scan; NO records yet (needs Hindi/Sanskrit OCR or page-by-page transcription)" },
  "OSHO-ASHTA": { title: "Ashtavakra Mahageeta Bhag 1 (Hindi)", tradition: "Osho", status: "supplied; Hindi text layer corrupted; NO records yet" },
  "OSHO-JD": { title: "Jeevan Darshan (Hindi)", tradition: "Osho", status: "supplied; Hindi text layer corrupted; NO records yet" },
  "OSHO-ASTRO": { title: "Astrology: Superstition, Blind Faith, or a Door to the Essential? (Osho)", tradition: "Osho", status: "NOT SUPPLIED" } };
export async function allRecords() { return [...RECORDS, ...(await getExtra())]; }
export async function activeRecords() { const dis = await getDisabled(); return (await allRecords()).filter(r => !dis.has(r.id)); }
export async function getRecord(id) { return (await activeRecords()).find(r => r.id === id) || null; }
export async function search(query, limit = 5) {
  const toks = [...new Set(String(query).toLowerCase().match(/\p{L}{3,}/gu) || [])];
  return (await activeRecords()).map(r => { const t = [r.original_term, r.source_supported_summary, r.rule_or_concept, r.english_explanation].join(" ").toLowerCase();
    return [toks.reduce((n, k) => n + t.split(k).length - 1, 0), r]; }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, limit).map(x => x[1]);
}
export async function coverage() {
  const all = await allRecords(), dis = await getDisabled(), out = {};
  for (const [id, s] of Object.entries(SOURCES)) { const rs = all.filter(r => r.source_id === id);
    out[id] = { ...s, records: rs.length, enabled: rs.filter(r => !dis.has(r.id)).length, verified: rs.filter(r => r.verification_status.startsWith("source_verified")).length }; }
  return out;
}
