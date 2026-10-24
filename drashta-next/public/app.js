(() => {
  "use strict";
  const $ = id => document.getElementById(id), KEY = "drashta_session_v2";
  const log = $("log"), chips = $("chips"), input = $("input"), sendBtn = $("send"), status = $("status");
  let token = null, msgs = [], busy = false, last = null;

  function setStatus(text, cls) { status.textContent = text; status.className = "pill " + (cls || ""); }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ token, msgs })); } catch (e) { /* storage unavailable: session just won't survive reload */ } }
  function wipe() { try { sessionStorage.removeItem(KEY); } catch (e) {} token = null; msgs = []; log.textContent = ""; chips.textContent = ""; }

  async function api(path, payload) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 35000);
    try {
      const res = await fetch(path, { method: payload ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined, signal: ctl.signal });
      let data = null; try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
      if (!res.ok) { const err = new Error((data && data.error) || `Server error (${res.status})`); err.code = data && data.code; throw err; }
      if (!data) throw new Error("The server sent an unreadable response.");
      return data;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("The request timed out. Please try again.");
      if (e instanceof TypeError) throw new Error("Cannot reach the server. Check your connection.");
      throw e;
    } finally { clearTimeout(t); }
  }
  function bubble(kind, text, persist) {
    const d = document.createElement("div"); d.className = "msg " + kind; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight;
    if (persist) { msgs.push({ kind, text }); } return d;
  }
  function errorBubble(message, retry) {
    const d = bubble("err", message); d.setAttribute("role", "alert");
    if (retry) { const b = document.createElement("button"); b.type = "button"; b.textContent = "Retry"; b.onclick = () => { d.remove(); retry(); }; d.appendChild(b); }
  }
  function chartCard(ch) {
    const det = document.createElement("details"); det.className = "chart"; const sum = document.createElement("summary");
    sum.textContent = `D1 chart - Lagna ${ch.lagna.sign} ${ch.lagna.dms} (tap to expand)`; det.appendChild(sum);
    const wrap = document.createElement("div"); wrap.className = "tbl"; const tb = document.createElement("table");
    const row = (cells, th) => { const tr = document.createElement("tr"); cells.forEach(c => { const e = document.createElement(th ? "th" : "td"); e.textContent = c; tr.appendChild(e); }); tb.appendChild(tr); };
    row(["Planet", "Sign", "Deg", "House", "Nakshatra", "Pada", "State"], true);
    Object.entries(ch.planets).forEach(([p, v]) => row([p, v.sign, v.dms, v.house, v.nakshatra, v.pada, [v.retrograde && "R", v.combust && "combust", v.dignity.split(" ")[0]].filter(Boolean).join(", ")]));
    wrap.appendChild(tb); det.appendChild(wrap);
    const n = document.createElement("div"); n.className = "fine"; n.textContent = `${ch.settings.ayanamsha} ayanamsha, ${ch.settings.house_system}. ${ch.settings.ephemeris}`; det.appendChild(n);
    log.appendChild(det); log.scrollTop = log.scrollHeight;
  }
  function setChoices(list) {
    chips.textContent = ""; chips.className = list.length > 3 && list[0].label.length > 12 ? "cards" : "chips";
    (list || []).forEach(c => { const b = document.createElement("button"); b.type = "button"; b.textContent = c.label; b.onclick = () => send(c.value, c.label); chips.appendChild(b); });
  }
  function setBusy(v) { busy = v; input.disabled = v; sendBtn.disabled = v; chips.querySelectorAll("button").forEach(b => b.disabled = v); }
  function typing(on) { const old = $("typing"); if (old) old.remove(); if (!on) return; const d = document.createElement("div"); d.id = "typing"; d.className = "typing"; d.setAttribute("aria-label", "Drashta AI is replying"); d.innerHTML = "<i></i><i></i><i></i>"; log.appendChild(d); log.scrollTop = log.scrollHeight; }
  function applyMode(mode) { $("modeNote").textContent = mode === "demo" ? "DEMO MODE - rule-based replies, no AI model connected" : "Live AI model connected (chart facts remain deterministic)"; }

  async function call(payload, shown) {
    last = { payload, shown }; setBusy(true); typing(true);
    try {
      const r = await api("/api/chat", payload); token = r.token; applyMode(r.mode);
      typing(false); bubble("bot", r.reply, true); if (r.chart) chartCard(r.chart); setChoices(r.choices || []); save();
    } catch (e) {
      typing(false);
      if (e.code === "bad_session") { wipe(); errorBubble(e.message + " Your details were cleared from this browser.", () => start()); }
      else errorBubble(e.message, () => call(payload, shown));
    } finally { typing(false); setBusy(false); if (!input.disabled) input.focus(); }
  }
  function send(value, label) { if (busy || !token) return; const v = String(value).trim(); if (!v) return; bubble("user", label || v, true); setChoices([]); call({ token, message: v }); }
  function start() { $("welcome").classList.add("hidden"); $("chatWrap").classList.remove("hidden"); wipe(); call({ token: null }); }
  function restore() {
    try { const s = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (s && s.token && Array.isArray(s.msgs) && s.msgs.length) {
      token = s.token; msgs = s.msgs; $("welcome").classList.add("hidden"); $("chatWrap").classList.remove("hidden"); msgs.forEach(m => bubble(m.kind, m.text)); return true; } } catch (e) {} return false;
  }
  $("begin").onclick = start;
  $("form").onsubmit = e => { e.preventDefault(); const v = input.value; input.value = ""; send(v); };
  $("reset").onclick = () => { if (!busy) start(); };
  $("wipe").onclick = () => { wipe(); $("chatWrap").classList.add("hidden"); $("welcome").classList.remove("hidden"); };

  (async () => {
    try {
      const c = await api("/api/config"); $("brandName").textContent = c.name;
      if (!c.ready) setStatus("Server not configured", "bad"); else setStatus(c.mode === "demo" ? "Online - demo mode" : "Online - live AI", c.mode === "demo" ? "warn" : "ok");
      applyMode(c.mode); if (c.issues && c.issues.length) status.title = c.issues.join("\n");
    } catch (e) { setStatus("Offline", "bad"); status.title = e.message; }
    if (restore()) { setChoices([]); bubble("bot", "Session restored in this browser. Continue where you left off, or press Start over."); }
  })();
})();
