const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const dataFile = path.resolve(process.env.DATA_FILE || path.join(root, 'data/site.json'));
const uploadsDir = path.resolve(process.env.UPLOAD_DIR || path.join(path.dirname(dataFile), 'uploads'));
const baseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const secret = process.env.SUPABASE_SECRET_KEY || '';
const bucket = process.env.SUPABASE_BUCKET || 'tathva-media';
if (!baseUrl || !secret) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY before running this migration.');

async function request(endpoint, options = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: { apikey:secret, ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${(await response.text()).slice(0,300)}`);
  return response;
}

async function main() {
  const site = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const media = [
    ...Object.values(site.carousels || {}).flat(),
    ...(site.venues || [])
  ];
  for (const item of media) {
    if (!String(item.src || item.image || '').startsWith('/media/')) continue;
    const field = item.src ? 'src' : 'image';
    const name = path.basename(item[field]);
    const file = path.join(uploadsDir, name);
    if (!fs.existsSync(file)) throw new Error(`Missing local upload ${file}; copy the active data/uploads files before migration.`);
    const bytes = fs.readFileSync(file);
    if (bytes.length > 8 * 1024 * 1024) throw new Error(`${name} is larger than this site's 8 MB upload limit.`);
    const ext = path.extname(name).toLowerCase();
    const contentType = ({'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4'})[ext];
    if (!contentType) throw new Error(`Unsupported media type for ${name}.`);
    const cloudName = `${crypto.randomUUID()}${ext}`;
    await request(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(cloudName)}`, {
      method:'POST', headers:{'Content-Type':contentType,'x-upsert':'true'}, body:bytes
    });
    item[field] = `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(cloudName)}`;
    console.log(`Uploaded ${name}`);
  }
  await request('/rest/v1/site_content?on_conflict=id', {
    method:'POST', headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({id:'main',content:site})
  });
  console.log(`Published ${dataFile} to Supabase table site_content.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
