(() => {
  "use strict";
  const $ = id => document.getElementById(id), H = { "Content-Type": "application/json", "X-Requested-With": "drashta" }, TOPICS = [["career","Career"],["marriage","Marriage"],["finance","Finance"],["spiritual","Spiritual (Osho)"]];
  function note(text, ok) { const m = $("msg"); m.textContent = text; m.className = "banner " + (ok ? "ok" : "bad"); m.hidden = !text; }
  async function j(path, method, body) {
    let r; try { r = await fetch(path, { method: method || "GET", headers: H, body: body ? JSON.stringify(body) : undefined }); } catch (e) { throw new Error("Cannot reach the server."); }
    let d = null; try { d = await r.json(); } catch (e) {} if (!r.ok) { const e = new Error((d && d.error) || `Error ${r.status}`); e.status = r.status; throw e; } return d;
  }
  const cell = (tr, t, th) => { const c = document.createElement(th ? "th" : "td"); if (t instanceof Node) c.appendChild(t); else c.textContent = t; tr.appendChild(c); };
  async function load() {
    try {
      const [s, k, dg] = await Promise.all([j("/api/admin/settings"), j("/api/admin/knowledge"), j("/api/admin/diagnostics")]);
      $("login").classList.add("hidden"); $("panel").classList.remove("hidden");
      for (const f of ["assistant_name","provider","model","welcome","instructions","ayanamsha"]) $(f).value = s[f];
      $("topics").textContent = ""; TOPICS.forEach(([id, l]) => { const lb = document.createElement("label"), cb = document.createElement("input"); cb.type = "checkbox"; cb.value = id; cb.checked = s.topics_enabled.includes(id); lb.append(cb, " " + l); $("topics").appendChild(lb); });
      $("diag").textContent = `Settings store: ${dg.store}. Session secret: ${dg.session_secret ? "set" : "MISSING"}. Admin password: ${dg.admin_password ? "set" : "missing"}. AI key: ${dg.anthropic_key ? "configured" : "not configured (demo mode)"}. Ephemeris: ${dg.ephemeris}. ${dg.data_retention}`;
      $("cov").textContent = ""; Object.entries(k.coverage).forEach(([id, c]) => { const d = document.createElement("div"); d.style.margin = "10px 0";
        const t = document.createElement("div"); t.textContent = `${id} - ${c.title}: ${c.enabled}/${c.records} active, ${c.verified} source-verified`; const st = document.createElement("div"); st.className = "fine"; st.textContent = c.status;
        const bar = document.createElement("div"); bar.className = "bartrack"; const b = document.createElement("b"); b.style.width = (c.records ? Math.round(100 * c.verified / c.records) : 0) + "%"; bar.appendChild(b); d.append(t, st, bar); $("cov").appendChild(d); });
      const tb = $("recs"); tb.textContent = ""; const h = document.createElement("tr"); ["ID","Source","Page","Verification","Active"].forEach(x => cell(h, x, true)); tb.appendChild(h);
      k.records.forEach(r => { const tr = document.createElement("tr"); const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = r.enabled; cb.setAttribute("aria-label", "Toggle " + r.id);
        cb.onchange = async () => { try { await j("/api/admin/knowledge", "POST", { toggle: r.id }); note("Updated " + r.id, true); } catch (e) { cb.checked = !cb.checked; note(e.message); } };
        [r.id, r.source, r.page, r.verification, cb].forEach(x => cell(tr, x)); tb.appendChild(tr); });
      $("events").textContent = dg.events.length ? dg.events.map(e => `${e.ts} ${e.level}: ${e.msg}`).join("\n") : "No errors recorded since this server instance started."; $("events").style.whiteSpace = "pre-wrap";
    } catch (e) { if (e.status === 401) { $("panel").classList.add("hidden"); $("login").classList.remove("hidden"); } else note(e.message); }
  }
  $("go").onclick = async () => { try { await j("/api/admin/login", "POST", { password: $("pw").value }); $("pw").value = ""; note("", true); load(); } catch (e) { note(e.message); } };
  $("save").onclick = async () => { try { const body = { topics_enabled: [...document.querySelectorAll("#topics input:checked")].map(x => x.value) };
      for (const f of ["assistant_name","provider","model","welcome","instructions","ayanamsha"]) body[f] = $(f).value; await j("/api/admin/settings", "PUT", body); note("Settings saved.", true); load(); } catch (e) { note(e.message); } };
  $("out").onclick = async () => { try { await j("/api/admin/logout", "POST"); } catch (e) {} location.reload(); };
  load();
})();
