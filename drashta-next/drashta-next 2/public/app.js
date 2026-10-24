(() => {
  "use strict";
  const $ = id => document.getElementById(id), KEY = "drashta_session_v2";
  const log = $("log"), chips = $("chips"), input = $("input"), sendBtn = $("send"), status = $("status");
  let token = null, msgs = [], busy = false, last = null, authToken = null, sessionId = null;
  try { authToken = sessionStorage.getItem("drashta_auth_token_v1") || null; } catch (e) {}

  function setStatus(text, cls) { status.textContent = text; status.className = "pill " + (cls || ""); }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ token, msgs, sessionId })); } catch (e) { /* storage unavailable: session just won't survive reload */ } }
  function wipe() { try { sessionStorage.removeItem(KEY); } catch (e) {} token = null; sessionId = null; msgs = []; log.textContent = ""; chips.textContent = ""; }

  async function api(path, payload) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 35000);
    try {
      const headers = { "Content-Type": "application/json" }; if (authToken) headers.Authorization = "Bearer " + authToken; const res = await fetch(path, { method: payload ? "POST" : "GET", headers, body: payload ? JSON.stringify(payload) : undefined, signal: ctl.signal });
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
  function applyMode(mode) { $("modeNote").textContent = mode === "demo" ? "DEMO MODE - rule-based replies, no AI model connected" : "Live AI model configured (chart facts remain deterministic)"; }

  async function call(payload, shown) {
    last = { payload, shown }; setBusy(true); typing(true);
    try {
      const outgoing = { ...payload }; if (authToken) outgoing.authToken = authToken; if (sessionId) outgoing.sessionId = sessionId;
      const r = await api("/api/chat", outgoing); token = r.token; if (r.sessionId) sessionId = r.sessionId; applyMode(r.mode); if (authToken && payload.token !== null) $("modeNote").textContent += r.persistence ? " · Saved to Supabase" : " · Chat save unavailable; check database configuration";
      typing(false); bubble("bot", r.reply, true); if (r.chart) chartCard(r.chart); setChoices(r.choices || []); save();
    } catch (e) {
      typing(false);
      if (e.code === "bad_session") { wipe(); errorBubble(e.message + " Your details were cleared from this browser.", () => start()); }
      else if (e.code === "auth_expired") { authToken = null; try { sessionStorage.removeItem("drashta_auth_token_v1"); } catch(e) {} wipe(); $("chatWrap").classList.add("hidden"); $("welcome").classList.remove("hidden"); $("authNote").textContent = "Account session expired. Please sign in again; guest mode remains available."; errorBubble(e.message); }
      else errorBubble(e.message, () => call(payload, shown));
    } finally { typing(false); setBusy(false); if (!input.disabled) input.focus(); }
  }
  function send(value, label) { if (busy || !token) return; const v = String(value).trim(); if (!v) return; bubble("user", label || v, true); setChoices([]); call({ token, message: v }); }
  function start() { $("welcome").classList.add("hidden"); $("chatWrap").classList.remove("hidden"); wipe(); call({ token: null }); }
  function restore() {
    try { const s = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (s && s.token && Array.isArray(s.msgs) && s.msgs.length) {
      token = s.token; msgs = s.msgs; sessionId = s.sessionId || null; $("welcome").classList.add("hidden"); $("chatWrap").classList.remove("hidden"); msgs.forEach(m => bubble(m.kind, m.text)); return true; } } catch (e) {} return false;
  }
  async function authAction(which) {
    const note=$("authNote"), email=$("authEmail").value.trim(), password=$("authPassword").value, name=$("authName").value.trim();
    note.textContent="Working…";
    try { const r=await api(`/api/auth/${which}`, { email, password, name });
      if (r.needsEmailConfirmation) { note.textContent=r.message||"Check your email to confirm the account."; return; }
      authToken=r.accessToken; if(!authToken) throw new Error("Account response did not include a session. Try signing in after email confirmation.");
      try { sessionStorage.setItem("drashta_auth_token_v1",authToken); } catch(e) {}
      note.textContent=`Signed in as ${r.user?.email||email}. Your new chats will be saved.`; $("begin").textContent="Start consultation";
      await refreshHistory();
    } catch(e) { note.textContent=e.message; }
  }
  async function refreshHistory() {
    if(!authToken) return;
    try { const r=await api("/api/user/history"); const list=$("historyList"); list.textContent="";
      (r.sessions||[]).forEach(s=>{ const b=document.createElement("button"); b.type="button"; b.textContent=`${s.title||"New Chat"} · ${new Date(s.created_at).toLocaleString()}`; b.onclick=()=>viewHistory(s.id); list.appendChild(b); });
      if(!(r.sessions||[]).length) list.textContent="No saved conversations yet.";
    } catch(e) { $("historyList").textContent=e.message; }
  }
  async function viewHistory(id) {
    try { const r=await api("/api/user/history",{sessionId:id}); log.textContent=""; chips.textContent="";
      (r.messages||[]).forEach(m=>bubble(m.role==="user"?"user":"bot",m.content,false));
      const n=document.createElement("div"); n.className="fine"; n.textContent="Viewing saved history (read-only). Press New chat to start a fresh consultation."; log.appendChild(n);
      $("historyPanel").classList.add("hidden"); $("welcome").classList.add("hidden"); $("chatWrap").classList.remove("hidden"); token=null; sessionId=null;
    } catch(e) { errorBubble(e.message); }
  }
  $("loginBtn").onclick=()=>authAction("login"); $("signupBtn").onclick=()=>authAction("signup");
  $("historyBtn").onclick=async()=>{ if(!authToken){ $("historyPanel").classList.toggle("hidden"); $("historyList").textContent="Sign in to view saved chat history."; return; } $("historyPanel").classList.toggle("hidden"); await refreshHistory(); };
  $("begin").onclick = start;
  $("form").onsubmit = e => { e.preventDefault(); const v = input.value; input.value = ""; send(v); };
  $("reset").onclick = () => { if (!busy) start(); };
  $("wipe").onclick = () => { wipe(); $("chatWrap").classList.add("hidden"); $("welcome").classList.remove("hidden"); };

  (async () => {
    try {
      const c = await api("/api/config"); $("brandName").textContent = c.name;
      if (!c.ready) setStatus("Server not configured", "bad"); else setStatus(c.mode === "demo" ? "Online - demo mode" : "Online - live model configured", c.mode === "demo" ? "warn" : "ok");
      applyMode(c.mode); if (c.issues && c.issues.length) status.title = c.issues.join("\n");
    } catch (e) { setStatus("Offline", "bad"); status.title = e.message; }
    if (restore()) { setChoices([]); bubble("bot", "Session restored in this browser. Continue where you left off, or press New chat."); }
    if (authToken) { $("begin").textContent="Start consultation"; $("authNote").textContent="Account session found in this browser tab."; refreshHistory(); }
  })();
})();
