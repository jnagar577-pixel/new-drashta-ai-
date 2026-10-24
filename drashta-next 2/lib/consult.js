// Conversation state machine + rule evaluation. Chart facts come only from chart.js. State is passed in/out (stateless server).
import * as C from "./chart.js"; import { resolvePlace } from "./places.js"; import * as llm from "./llm.js"; import { logEvent } from "./store.js";
export const TOPICS = { 1: "career", 2: "marriage", 3: "finance", 4: "spiritual" };
export const LABEL = { career: "Career", marriage: "Marriage", finance: "Finance", spiritual: "Spiritual Talk: Osho philosophy" };
const KARAKA = { career: "Saturn", marriage: "Venus" }; // DRASHTA-BNN-004 (R. G. Rao, intro p. iii)
const TOPIC_RULES = { career: ["DRASHTA-BNN-004","DRASHTA-BNN-005","DRASHTA-BNN-006"], marriage: ["DRASHTA-BNN-004","DRASHTA-BNN-006"], finance: [], spiritual: [] };
export const newState = () => ({ step: "name", d: {}, topic: null, hist: [], back: false });

export function parseDate(s) {
  const t = String(s).trim(); let m, y, mo, d;
  // Accept plain dates, ISO dates, and dates followed by a weekday or other label.
  if ((m = t.match(/(?:^|\D)(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})(?:\D|$)/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if ((m = t.match(/(?:^|\D)(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d)); if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return y >= 1900 && dt <= new Date() ? `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}` : null;
}
export function parseTime(s) {
  const t=String(s).trim().toLowerCase().replace(/\./g, ":");
  let m=t.match(/^(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)$/i);
  if (m) { let h=+m[1], mi=+m[2], ap=m[3].toUpperCase(); if(h<1||h>12||mi>59) return null; return [h,mi,ap]; }
  // 24-hour clock is unambiguous and accepted too (e.g. 13:30 or 00:15).
  m=t.match(/^(\d{1,2})\s*:\s*(\d{2})$/);
  if (m) { const h=+m[1], mi=+m[2]; if(h>23||mi>59 || (h>0 && h<13)) return null; return [h%12||12,mi,h>=12?"PM":"AM"]; }
  return null;
}
const buildChart = (d, cfg) => { const [y, mo, da] = d.dob.split("-").map(Number), [h, mi, ap] = d.time;
  const utc = C.localToUtc(y, mo, da, h, mi, ap, d.place.tz); return { utc, chart: C.computeChart(utc, d.place.lat, d.place.lon, { ayanamsha: cfg.ayanamsha }) }; };
const pad = n => String(n).padStart(2, "0");
const confirmText = d => `Please confirm:\nName: ${d.name}\nDate of birth: ${d.dob}\nBirthplace: ${d.place.name} (lat ${d.place.lat}, lon ${d.place.lon}, tz ${d.place.tz})\nBirth time: ${pad(d.time[0])}:${pad(d.time[1])} ${d.time[2]} (${d.exact ? "exact" : "approximate"})\nSahi hai? (yes / no)`;
export function formatChart(ch) {
  const L = ch.lagna, lines = [`D1 (Lagna) chart - Lagna: ${L.sign} ${L.dms}, lord ${L.lord} in house ${L.lord_house}, ${L.nakshatra} pada ${L.pada}`];
  for (const [p, v] of Object.entries(ch.planets)) { const f = [v.retrograde && "retrograde", v.combust && "combust"].filter(Boolean);
    lines.push(`${p}: ${v.sign} ${v.dms} | house ${v.house} | ${v.nakshatra} pada ${v.pada} | ${v.dignity}${f.length ? " | " + f.join(", ") : ""}`); }
  lines.push("Houses: " + ch.houses.map(h => `H${h.house} ${h.sign}(${h.lord})${h.planets.length ? "[" + h.planets.join(",") + "]" : ""}`).join("; "));
  const s = ch.settings; lines.push(`Settings: ${s.ayanamsha} ayanamsha (${s.ayanamsha_value_deg} deg), ${s.node}, ${s.house_system}, D1 only. EPHEMERIS: ${s.ephemeris} - treat positions as unverified.`);
  return lines.join("\n");
}
export function planetFacts(ch, p) {
  const pl = ch.planets[p], si = C.SIGNS.indexOf(pl.sign), lord = C.LORDS[si], on = sg => Object.entries(ch.planets).filter(([q, x]) => x.sign === sg && q !== p).map(x => x[0]);
  const s7 = C.SIGNS[(si + 6) % 12], s12 = C.SIGNS[(si + 11) % 12];
  return { p, ...pl, sign_lord: lord, sign_lord_house: ch.planets[lord].house, same_sign: on(pl.sign), s7, in7: on(s7), s12, in12: on(s12),
    exchange: lord !== p && C.LORDS[C.SIGNS.indexOf(ch.planets[lord].sign)] === p, aspected_by: Object.entries(ch.aspects).filter(([q, a]) => q !== p && a.aspect_houses.includes(pl.house)).map(x => x[0]) };
}
const cite = r => `[${r.id} | ${r.source_title}, p. ${r.printed_page} | ${r.verification_status}] ${r.source_supported_summary}`;
export function topicReport(topic, ch, records) {
  const byId = Object.fromEntries(records.map(r => [r.id, r])), out = [], applied = (TOPIC_RULES[topic] || []).map(id => byId[id]).filter(Boolean);
  if (KARAKA[topic] && byId["DRASHTA-BNN-004"]) {
    const f = planetFacts(ch, KARAKA[topic]), j = a => a.length ? a.join(", ") : "none";
    out.push(`CALCULATED FACTS (D1, approximate ephemeris): ${f.p} is in ${f.sign}, house ${f.house}; dignity: ${f.dignity}; ${f.retrograde ? "retrograde" : "direct"}${f.combust ? ", combust" : ""}. Sign lord ${f.sign_lord} sits in house ${f.sign_lord_house}. Same sign: ${j(f.same_sign)}. In the 7th sign (${f.s7}): ${j(f.in7)}. In the 12th sign (${f.s12}): ${j(f.in12)}. Sign exchange: ${f.exchange ? "yes" : "no"}. Aspected by (graha drishti): ${j(f.aspected_by)}.`);
    out.push(applied.length ? "SOURCE-BACKED RULES APPLIED:\n" + applied.map(cite).join("\n") : "No active source rule is available for this topic (records disabled).");
    if (topic === "career") out.push("SOURCE NOTE: the same source says Saturn is neutral and results depend on his position, and that Jupiter's transit modifies results. Transits are NOT computed in this version, so that factor is unassessed.");
    out.push(`INFERENCE (not a source rule): the verified records name ${f.p} as the significator for ${topic} and list the factors to examine around it. They contain no verified statement mapping this placement to an outcome, so none is predicted.`);
  } else if (KARAKA[topic]) {
    out.push("No active source rule identifies the significator for this topic (the record that supplies it is disabled), so no chart factors are evaluated.");
  } else if (topic === "finance") {
    const a = ch.houses[1], b = ch.houses[10];
    out.push(`CALCULATED FACTS (D1): 2nd house ${a.sign} (lord ${a.lord} in house ${ch.planets[a.lord].house}); 11th house ${b.sign} (lord ${b.lord} in house ${ch.planets[b.lord].house}).`);
    out.push("NO VERIFIED SOURCE RULE: the knowledge base has no verified finance rule yet (the BPHS scan is not transcribed; the supplied Nadi sources have none recorded). Nothing about money outcomes is predicted.");
  } else {
    const spiritual = records.filter(r => r.pillar === "OSHO-REFLECTION" || String(r.id).startsWith("DRASHTA-OSHO-REF"));
    out.push("SPIRITUAL TALK MODE: prioritize the spiritual reflection records below. These are original Drashta reflections informed by themes associated with self-observation, awareness, non-attachment and the Ashtavakra tradition. They are not direct Osho quotations or a substitute for the supplied books. NO VERIFIED OSHO RECORDS: exact Osho passages are not yet verified, so never attribute these reflections directly to Osho.");
    out.push(spiritual.length ? "DRASHTA SPIRITUAL KNOWLEDGE:\n" + spiritual.map(cite).join("\n") : "NO VERIFIED OSHO RECORDS YET: the supplied Osho PDFs have corrupted Hindi text. I cannot attribute a specific view to Osho without a verified passage. I can still discuss awareness, witness-consciousness and non-attachment as a clearly labelled Drashta reflection, not a quotation.");
  }
  out.push("This is an interpretive reading of a calculated chart, not a scientific prediction or guarantee.");
  return out.join("\n\n");
}
const choicesFor = (st, cfg) => st.step === "exact" ? [{ label: "Exact", value: "exact" }, { label: "Approximate", value: "approximate" }]
  : st.step === "confirm" ? [{ label: "Yes, correct", value: "yes" }, { label: "No, fix something", value: "no" }]
  : st.step === "fixwhich" ? ["name", "date of birth", "place", "time"].map(v => ({ label: v, value: v }))
  : st.step === "menu" || st.step === "followup" ? Object.entries(TOPICS).filter(([, t]) => cfg.topics_enabled.includes(t)).map(([k, t]) => ({ label: LABEL[t], value: k })) : [];
const menuText = cfg => "What would you like to explore?\n" + Object.entries(TOPICS).filter(([, t]) => cfg.topics_enabled.includes(t)).map(([k, t]) => `${k}. ${LABEL[t]}`).join("\n");
const ASK = { name: "Aapka name kya hai?", dob: "Aapki date of birth batayein (DD-MM-YYYY, e.g. 22-07-2005). Weekday likhna optional hai.", place: "Birthplace batayein (city/state, or lat,lon,Timezone e.g. 23.26,77.41,Asia/Kolkata).", time: "Birth time batayein (e.g. 1:30 PM, 13:30, ya 03:15 AM)." };

export async function handle(st, msg, ctx) {
  const { cfg, records } = ctx; msg = String(msg || "").trim(); const d = st.d; let reply, chart = null;
  const go = (step, text) => { st.step = step; reply = text; };
  const toConfirm = () => go("confirm", confirmText(d));
  if (/^(restart|reset)$/i.test(msg)) { Object.assign(st, newState()); reply = cfg.welcome; return { state: st, reply, choices: [], chart: null }; }
  switch (st.step) {
    case "name": if (!/^[\p{L}][\p{L} .'\-]{0,59}$/u.test(msg)) reply = "Kripya apna naam likhein (letters only, up to 60 characters)."; else { d.name = msg; st.back ? (st.back = false, toConfirm()) : go("dob", `Dhanyavaad, ${msg}. ${ASK.dob}`); } break;
    case "dob": { const v = parseDate(msg); if (!v) reply = "Date samajh nahi aayi. Format: DD-MM-YYYY (e.g. 15-08-1947), between 1900 and today."; else { d.dob = v; st.back ? (st.back = false, toConfirm()) : go("place", ASK.place); } break; }
    case "place": { const p = resolvePlace(msg); if (!p) reply = "Yeh place mere offline table mein nahi mila. Please 'latitude,longitude,Timezone' likhein (e.g. 26.85,80.95,Asia/Kolkata) ya paas ke bade shehar ka naam."; else { d.place = p; st.back ? (st.back = false, toConfirm()) : go("time", ASK.time); } break; }
    case "time": { const t = parseTime(msg); if (!t) { reply = "Time samajh nahi aaya. AM/PM ke saath 1:30 PM, ya clear 24-hour format 13:30 use karein."; break; }
      try { const [y, mo, da] = d.dob.split("-").map(Number); C.localToUtc(y, mo, da, t[0], t[1], t[2], d.place.tz); } catch (e) { reply = e.message; break; }
      d.time = t; st.back = false; go("exact", "Kya yeh birth time exact hai ya approximate? (exact / approximate)"); break; }
    case "exact": { const l = msg.toLowerCase(); if (l.startsWith("e")) d.exact = true; else if (l.startsWith("a")) d.exact = false; else { reply = "Please reply 'exact' ya 'approximate'."; break; } toConfirm(); break; }
    case "confirm": { const l = msg.toLowerCase();
      if (["no", "n", "nahi", "nahin"].includes(l)) { go("fixwhich", "Theek hai. Kya sahi karna hai? (name / date of birth / place / time)"); break; }
      if (!["yes", "y", "haan", "han", "ha", "sahi"].includes(l)) { reply = "Please reply 'yes' ya 'no'."; break; }
      try { const { utc, chart: ch } = buildChart(d, cfg); let extra = "";
        if (!d.exact) { const ts = C.timeSensitivity(utc, d.place.lat, d.place.lon, 30, { ayanamsha: cfg.ayanamsha });
          extra = `\n\nApproximate time: within +/-30 minutes the Lagna ${ts.lagna_may_change ? "COULD CHANGE" : "would not change"} and the Moon's nakshatra ${ts.moon_nakshatra_may_change ? "could change" : "would not change"}. Treat Lagna-based details as provisional.`; }
        const mr = records.find(r => r.id === "DRASHTA-NJK-007");
        if (mr && ch.planets.Mercury.sun_distance < 14) extra += `\n\nCondition check [${mr.id} | ${mr.source_title}, p. ${mr.printed_page}]: Mercury is ${ch.planets.Mercury.sun_distance} deg from the Sun, within this author's 14-degree combustion criterion.`;
        chart = ch; go("menu", formatChart(ch) + extra + "\n\n" + menuText(cfg));
      } catch (e) { if (!(e instanceof C.ChartError)) throw e; go("time", `Chart nahi ban saka: ${e.message} Birth time dobara batayein.`); }
      break; }
    case "fixwhich": { const l = msg.toLowerCase(); const m = l.startsWith("n") ? "name" : l.startsWith("d") ? "dob" : l.startsWith("p") ? "place" : l.startsWith("t") ? "time" : null;
      if (!m) reply = "Please choose: name / date of birth / place / time."; else { st.back = m !== "time"; go(m, ASK[m]); } break; }
    default: {
      const l = msg.toLowerCase(); let chosen = TOPICS[msg.replace(/\.$/, "")];
      if (!chosen) for (const k of Object.keys(LABEL)) if (l.includes(k) || (k === "spiritual" && l.includes("osho"))) { chosen = k; break; }
      const { chart: ch } = buildChart(d, cfg);
      if (chosen) {
        if (!cfg.topics_enabled.includes(chosen)) { reply = "That topic is currently disabled.\n" + menuText(cfg); break; }
        st.topic = chosen; st.step = "followup"; st.hist = [...st.hist, chosen].slice(-4);
        const rep = topicReport(chosen, ch, records), ai = await aiLayer(st, ctx, ch, `Give a concise, careful reading of the ${chosen} facts for ${d.name}.`, rep);
        reply = rep + (ai ? "\n\n" + ai : "") + "\n\nAap follow-up pooch sakte hain, ya doosra topic chunein."; break; }
      if (st.step === "menu") { reply = "Please choose a topic.\n" + menuText(cfg); break; }
      const ai = await aiLayer(st, ctx, ch, msg, topicReport(st.topic, ch, records));
      reply = ai || `[Demo mode - no AI model] I can only answer chart-fact questions by topic right now. Choose a topic or type 'restart'. Last topic: ${LABEL[st.topic]}.`; }
  }
  return { state: st, reply, choices: choicesFor(st, cfg), chart };
}
async function aiLayer(st, ctx, ch, prompt, report) {
  const synonyms = { career:"profession work Saturn karma", marriage:"marriage relationship Venus", finance:"finance money wealth", spiritual:"Osho Ashtavakra Jeevan Darshan awareness witness meditation self-observation non-attachment" };
  const retrieved = await (await import("./knowledge.js")).search(`${st.topic || ""} ${synonyms[st.topic] || ""} ${prompt}`, 6);
  if (!llm.isLive(ctx.cfg)) {
    if (!retrieved.length) return null;
    const refs = retrieved.map(r => `[${r.id} | ${r.source_title}, p. ${r.printed_page} | ${r.verification_status}] ${r.source_supported_summary}`).join("\n");
    return `[Knowledge retrieval mode · no live AI model configured]\nRelevant knowledge records (source-grounded excerpts, not a newly generated prediction):\n${refs}\n\nFor an interpretation beyond these records, configure a live model provider. The current evidence does not justify adding an outcome that the sources do not state.`;
  }
  const evidence = retrieved.map(r => `[${r.id} | ${r.source_title}, p. ${r.printed_page} | ${r.verification_status}] ${r.source_supported_summary}`).join("\n");
  const spiritualRules = st.topic === "spiritual" ? "For spiritual discussion, use a reflective, non-dogmatic voice. Distinguish the underlying Ashtavakra text, commentary, and Drashta reflection. Never fabricate Osho quotes or present a reflection as a direct quotation." : "Keep Parashari, BNN and spiritual interpretations methodologically separate. Do not silently merge systems.";
  const sys = `${ctx.cfg.instructions}\nUser name: ${st.d.name}. Chart JSON (authoritative, do not alter): ${JSON.stringify(ch.planets)}\nRule-evaluation report: ${report}\nRetrieved knowledge records (use only relevant records and cite exact IDs; if irrelevant, say so):\n${evidence || "No matching knowledge records retrieved."}\n${spiritualRules} Label inference as INFERENCE. No outcome guarantees. Never invent citations, placements, sources, or predictions.`;
  try { const t = await llm.generate(ctx.cfg, sys, [{ role: "user", content: prompt }]); return `[AI-generated by ${ctx.cfg.model} - treat as interpretation]\n${t}`; }
  catch (e) { logEvent("error", "LLM provider failure: " + e.message); return "[Live model unavailable right now - showing rule-based output only.]"; }
}
