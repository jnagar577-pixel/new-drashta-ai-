// Server-only Supabase REST helpers. Never import this module in browser code.
const base = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const service = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const anon = () => process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const configured = () => !!(base() && service() && anon());
async function request(url, { method='GET', headers={}, body, timeout=9000 }={}) {
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch {}
  if (!r.ok) { const e = new Error(data?.msg || data?.message || data?.error_description || data?.error || `Supabase HTTP ${r.status}`); e.status = r.status; throw e; }
  return data;
}
export async function auth(path, body) {
  if (!base() || !anon()) throw new Error('Supabase Auth is not configured.');
  return request(`${base()}/auth/v1/${path}`, { method:'POST', headers:{ apikey:anon(), 'Content-Type':'application/json' }, body });
}
export async function verifyUser(accessToken) {
  if (!base() || !anon() || typeof accessToken !== 'string' || !accessToken) return null;
  try { const u = await request(`${base()}/auth/v1/user`, { headers:{ apikey:anon(), Authorization:`Bearer ${accessToken}` } }); return u?.id ? u : null; } catch { return null; }
}
export async function db(table, { method='GET', query='', body, prefer, select='*' }={}) {
  if (!base() || !service()) throw new Error('Supabase database integration is not configured on the server.');
  const q = query || `select=${encodeURIComponent(select)}`;
  const headers = { apikey:service(), Authorization:`Bearer ${service()}`, 'Content-Type':'application/json' };
  if (prefer) headers.Prefer = prefer;
  return request(`${base()}/rest/v1/${table}?${q}`, { method, headers, body });
}
export async function ensureProfile(user) {
  if (!user?.id) return;
  const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Drashta user';
  await db('profiles', { method:'POST', query:'on_conflict=id', body:{ id:user.id, display_name:name }, prefer:'resolution=merge-duplicates,return=minimal' });
}
export async function createSession(userId, title='New Chat') {
  const rows = await db('chat_sessions', { method:'POST', query:'select=id,title,created_at', body:{ user_id:userId, title }, prefer:'return=representation' });
  return Array.isArray(rows) ? rows[0] : rows;
}
export async function saveMessage(sessionId, role, content) {
  return db('chat_messages', { method:'POST', query:'select=id,session_id,role,content,created_at', body:{ session_id:sessionId, role, content:String(content).slice(0,12000) }, prefer:'return=representation' });
}
export async function updateSessionTitle(sessionId, userId, title) {
  return db('chat_sessions', { method:'PATCH', query:`id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`, body:{title:String(title).slice(0,80)}, prefer:'return=minimal' });
}
export async function listSessions(userId) {
  return db('chat_sessions', { query:`select=id,title,created_at&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=50` });
}
export async function listMessages(sessionId) {
  return db('chat_messages', { query:`select=id,session_id,role,content,created_at&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc&limit=500` });
}
export async function listUsers() {
  const profiles = await db('profiles', { query:'select=id,display_name,created_at&order=created_at.desc&limit=100' });
  return profiles;
}
export async function adminHistory() {
  const sessions = await db('chat_sessions', { query:'select=id,user_id,title,created_at&order=created_at.desc&limit=50' });
  return Promise.all(sessions.map(async s => ({ ...s, messages: await listMessages(s.id) })));
}
export async function listKnowledge() {
  return db('knowledge_records', { query:'select=id,title,category,source,status,created_at&order=created_at.desc&limit=500' });
}

export async function listApprovedKnowledge() {
  return db('knowledge_records', { query:'select=id,title,content,category,source,status&status=eq.approved&order=created_at.desc&limit=500' });
}
