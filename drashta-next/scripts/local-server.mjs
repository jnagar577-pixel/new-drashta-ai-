// Dependency-free local server: same handlers + static UI as the Vercel deployment (no Next.js needed). Usage: npm run local
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import * as H from "../lib/handlers.js";
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const routes = { "GET /api/config": H.config, "POST /api/chat": H.chat, "POST /api/admin/login": H.adminLogin, "POST /api/admin/logout": H.adminLogout,
  "GET /api/admin/settings": H.adminSettings, "PUT /api/admin/settings": H.adminSettings, "GET /api/admin/knowledge": H.adminKnowledge, "POST /api/admin/knowledge": H.adminKnowledge, "GET /api/admin/diagnostics": H.adminDiagnostics };
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
export function createServer() {
  return http.createServer(async (rq, rs) => {
    const url = new URL(rq.url, "http://localhost"), key = `${rq.method} ${url.pathname}`;
    if (routes[key]) { const chunks = []; for await (const c of rq) chunks.push(c); const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const res = await routes[key](new Request(url, { method: rq.method, headers: rq.headers, body: ["GET", "HEAD"].includes(rq.method) ? undefined : body }));
      const h = Object.fromEntries(res.headers); const sc = res.headers.getSetCookie?.(); if (sc?.length) h["set-cookie"] = sc; rs.writeHead(res.status, h); return rs.end(Buffer.from(await res.arrayBuffer())); }
    let p = url.pathname === "/" ? "/index.html" : url.pathname === "/admin" ? "/admin.html" : url.pathname; const f = path.join(pub, path.normalize(p).replace(/^(\.\.[\/\\])+/, ""));
    if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end("Not found"); }
    rs.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream", "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'" }); fs.createReadStream(f).pipe(rs);
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const port = process.env.PORT || 3000; createServer().listen(port, () => console.log(`Drashta AI local server: http://localhost:${port}  (admin: /admin)`)); }
