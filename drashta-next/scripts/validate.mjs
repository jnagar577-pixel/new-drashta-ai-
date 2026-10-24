import { RECORDS } from "../lib/knowledge-data.js"; import { validateRecord } from "../lib/validate-record.js";
let bad = 0; for (const r of RECORDS) { const e = validateRecord(r); if (e.length) { bad++; console.error(r.id, e.join("; ")); } }
console.log(`${RECORDS.length} records, ${bad} invalid`); process.exit(bad ? 1 : 0);
