const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'site.json');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'tathva-media';
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
if (Boolean(SUPABASE_URL) !== Boolean(SUPABASE_SECRET_KEY)) throw new Error('Set both SUPABASE_URL and SUPABASE_SECRET_KEY, or leave both unset.');
const PASSWORD = process.env.CMS_PASSWORD || (process.env.NODE_ENV === 'production' ? null : 'change-this-before-deploying');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.copyFileSync(path.join(ROOT, 'data/site.json'), DATA_FILE);

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.mp4':'video/mp4' };
const staticFiles = new Map([
  ['/app.js', path.join(ROOT, 'app.js')],
  ['/styles.css', path.join(ROOT, 'styles.css')],
  ['/public/ogs-logo.png', path.join(ROOT, 'public/ogs-logo.png')],
  ['/public/tathva-logo.png', path.join(ROOT, 'public/tathva-logo.png')]
]);
const send = (res, status, body, headers={}) => { res.writeHead(status, { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin', 'X-Frame-Options':'DENY', ...headers }); res.end(body); };
const json = (res, status, body, headers={}) => send(res, status, JSON.stringify(body), { 'Content-Type':'application/json; charset=utf-8', ...headers });
async function supabaseRequest(endpoint, options={}) {
  const response = await fetch(`${SUPABASE_URL}${endpoint}`, { ...options, headers: { apikey:SUPABASE_SECRET_KEY, ...(options.headers||{}) } });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${(await response.text()).slice(0,300)}`);
  return response;
}
async function writeRemoteSite(site) {
  await supabaseRequest('/rest/v1/site_content?on_conflict=id', { method:'POST', headers:{ 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify({id:'main',content:site}) });
}
async function readSite() {
  if (!SUPABASE_ENABLED) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const response = await supabaseRequest('/rest/v1/site_content?id=eq.main&select=content');
  const rows = await response.json();
  if (rows.length) return rows[0].content;
  const initial = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  await writeRemoteSite(initial);
  return initial;
}
async function saveSite(site) {
  if (SUPABASE_ENABLED) return writeRemoteSite(site);
  fs.writeFileSync(DATA_FILE, JSON.stringify(site, null, 2));
}
async function uploadRemoteMedia(name, buffer, contentType) {
  const objectPath = encodeURIComponent(name);
  await supabaseRequest(`/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${objectPath}`, { method:'POST', headers:{ 'Content-Type':contentType, 'x-upsert':'true', 'Cache-Control':'public, max-age=31536000, immutable' }, body:buffer });
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/${objectPath}`;
}
function body(req) {
  return new Promise((resolve, reject) => {
    let data = '', size = 0, settled = false;
    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > 12_000_000) {
        settled = true;
        reject(Object.assign(new Error('Request too large'), { statusCode:413 }));
        req.resume();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (settled) return;
      try { resolve(JSON.parse(data || '{}')); } catch { reject(Object.assign(new Error('Invalid JSON'), { statusCode:400 })); }
    });
    req.on('error', error => { if (!settled) reject(error); });
  });
}
function makeSession() { const expires = String(Date.now() + 12 * 60 * 60 * 1000); const signature = crypto.createHmac('sha256', PASSWORD).update(expires).digest('hex'); return `${expires}.${signature}`; }
function safeStringEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function isAuthed(req) {
  if (!PASSWORD) return false;
  const token = (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('ogs_session='))?.slice(12);
  if (!token) return false;
  const [expires, signature] = token.split('.');
  if (!expires || !signature || !/^\d+$/.test(expires) || Number(expires) <= Date.now()) return false;
  const expected = crypto.createHmac('sha256', PASSWORD).update(expires).digest('hex');
  const providedBytes = Buffer.from(signature, 'hex'); const expectedBytes = Buffer.from(expected, 'hex');
  return providedBytes.length === expectedBytes.length && crypto.timingSafeEqual(providedBytes, expectedBytes);
}
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/site') return json(res, 200, await readSite());
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const input = await body(req);
      if (!PASSWORD) return json(res, 503, {error:'CMS_PASSWORD must be set before the CMS can be used.'});
      if (!safeStringEqual(input.password, PASSWORD)) return json(res, 401, {error:'That password didn’t match.'});
      const token = makeSession();
      return json(res, 200, {ok:true}, { 'Set-Cookie':`ogs_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') return json(res,200,{ok:true},{'Set-Cookie':'ogs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
    if (req.method === 'PUT' && url.pathname === '/api/site') {
      if (!isAuthed(req)) return json(res, 401, {error:'Sign in to edit the site.'});
      const next = await body(req);
      if (!next || !next.settings || !next.carousels || !Array.isArray(next.venues) || !['hero','side1','side2','side3'].every(k=>Array.isArray(next.carousels[k]))) return json(res,400,{error:'The site content is incomplete.'});
      for (const slides of Object.values(next.carousels)) for (const slide of slides) { if (!slide.title || !slide.src || !['image','video'].includes(slide.type)) return json(res,400,{error:'Each slide needs a title, media URL, and supported media type.'}); slide.duration = Math.max(3, Math.min(120, Number(slide.duration)||6)); }
      for (const venue of next.venues) for (const field of ['name','area','event','detail','time','status','image']) if (!String(venue[field]||'').trim()) return json(res,400,{error:`Every venue needs a ${field}.`});
      await saveSite(next); return json(res,200,{ok:true});
    }
    if (req.method === 'POST' && url.pathname === '/api/upload') {
      if (!isAuthed(req)) return json(res,401,{error:'Sign in to upload media.'});
      const input=await body(req); const match=String(input.data||'').match(/^data:(image\/(?:jpeg|png|webp)|video\/mp4);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return json(res,400,{error:'Use a JPG, PNG, WebP, or MP4 file.'});
      const buffer=Buffer.from(match[2],'base64'); if(buffer.length>8*1024*1024) return json(res,413,{error:'Files must be 8 MB or smaller.'});
      const ext={ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','video/mp4':'.mp4' }[match[1]]; const name=`${crypto.randomUUID()}${ext}`;
      const src = SUPABASE_ENABLED ? await uploadRemoteMedia(name,buffer,match[1]) : (fs.writeFileSync(path.join(UPLOAD_DIR,name),buffer),`/media/${name}`);
      return json(res,201,{src,type:match[1]==='video/mp4'?'video':'image'});
    }
    if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
      const name = path.basename(url.pathname);
      const file = path.join(UPLOAD_DIR, name);
      if (!fs.existsSync(file)) return send(res,404,'Not found');
      const stat = fs.statSync(file);
      res.writeHead(200, { 'Content-Type':mime[path.extname(file)]||'application/octet-stream', 'Content-Length':stat.size, 'Cache-Control':'public, max-age=31536000, immutable', 'X-Content-Type-Options':'nosniff' });
      const stream = fs.createReadStream(file);
      stream.on('error', () => res.destroy());
      return stream.pipe(res);
    }
    if (req.method === 'GET' && url.pathname === '/robots.txt') return send(res,200,'User-agent: *\nDisallow: /admin\n',{ 'Content-Type':'text/plain; charset=utf-8' });
    const isAdmin = url.pathname === '/admin' || url.pathname === '/admin/';
    const file = url.pathname === '/' || isAdmin ? path.join(ROOT, 'index.html') : staticFiles.get(url.pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res,404,'Not found');
    return send(res,200,fs.readFileSync(file),{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache',...(isAdmin?{'X-Robots-Tag':'noindex, nofollow, noarchive'}:{})});
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) console.error(err);
    const message = status < 500 || process.env.NODE_ENV !== 'production' ? err.message : 'Server error.';
    return json(res,status,{error:message || 'Server error.'});
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Tathva 2026 is running on ${PORT}`));
