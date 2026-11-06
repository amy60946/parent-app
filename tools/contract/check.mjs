#!/usr/bin/env node
// Sözleşme denetimi: ParentApp'in sunucuda çağırdığı her şey (RPC adı + argüman adları, tablo + sütunlar, Edge Function,
// giriş ayarları) gerçekten var mı? Yalnız OKUR: hiçbir satır yazmaz, oturum açmaz.
//   SUPABASE_URL=https://<proje>.supabase.co SUPABASE_KEY=<publishable> node tools/contract/check.mjs        (canlı)
//   SUPABASE_URL=http://127.0.0.1:54321 LOCAL=1 node tools/contract/check.mjs                                 (yerel tarif)
// Çıkış kodu 1: eksik/uyumsuz bir şey var (CI kırmızı). Liste: --list
// Nasıl: RPC'ye uygulamanın kullandığı argüman adlarıyla (değer null) girişsiz çağrı yapılır. Var ve imza uyuyorsa sunucu
// "yetki yok" (42501) der; yoksa ya da argüman adları uymuyorsa PGRST202. Tabloda `select=<sütunlar>&limit=0`:
// eksik tablo PGRST205/42P01, eksik sütun 42703. Girişsiz rolün çalıştırabildiği işlev ayrıca uyarılır (olmamalı).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const SRC = [join(ROOT, 'src'), join(ROOT, 'App.tsx')];

// Girişsiz de çağrılması beklenen (bilerek herkese açık) işlevler: çalıştırılabilmeleri hata değildir
const PUBLIC_OK = new Set(['client_config', 'legal_documents_for', 'clinic_invite_preview', 'invite_info']);

function files(p) {
  const st = statSync(p);
  if (st.isFile()) return /\.tsx?$/.test(p) ? [p] : [];
  return readdirSync(p).flatMap((f) => (f === 'node_modules' ? [] : files(join(p, f))));
}

// Dengeli parantez/küme içeriği (dizgeleri atlar)
function balanced(s, i, open, close) {
  let d = 0, q = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === open) d++;
    else if (c === close) { d--; if (d === 0) return s.slice(i + 1, j); }
  }
  return null;
}
// Nesne sabitinin üst düzey anahtarları ({ a: 1, b, ...x } → a, b)
function topKeys(obj) {
  const keys = []; let d = 0, q = null, tok = '';
  const flush = () => { const m = tok.trim().match(/^([A-Za-z_$][\w$]*)\s*(:|$)/); if (m && !tok.trim().startsWith('...')) keys.push(m[1]); tok = ''; };
  for (let j = 0; j < obj.length; j++) {
    const c = obj[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; if (d === 0) tok += c; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; if (d === 0) tok += c; continue; }
    if ('({['.includes(c)) d++;
    if (')}]'.includes(c)) d--;
    if (d === 0 && c === ',') flush(); else if (d === 0) tok += c;
  }
  flush();
  return keys;
}
function selectCols(sel) {
  // "a, b, c:d, e(f, g), h!inner(i)" → üst düzey sütunlar; ilişkiler ayrı
  const out = []; let d = 0, tok = '';
  for (const c of sel + ',') {
    if (c === '(') d++;
    if (c === ')') d--;
    if (c === ',' && d === 0) { const t = tok.trim(); if (t) out.push(t); tok = ''; } else tok += c;
  }
  return out.map((t) => t.replace(/^[\w]+:/, '').replace(/::\w+$/, '').trim()).filter((t) => t && t !== '*' && !t.includes('(') && !t.startsWith('count'));
}

export function extract() {
  const rpcs = new Map(), tables = new Map(), fns = new Set(), buckets = new Set(), dynamic = new Set();
  const where = new Map();
  const note = (k, f) => { if (!where.has(k)) where.set(k, relative(ROOT, f)); };
  for (const f of SRC.flatMap(files)) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\.rpc\(\s*'([a-z_0-9]+)'\s*(,\s*)?/g)) {
      const name = m[1];
      const args = rpcs.get(name) ?? new Set();
      if (m[2]) {
        const i = m.index + m[0].length;
        if (s[i] === '{') topKeys(balanced(s, i, '{', '}') ?? '').forEach((k) => args.add(k));
        else {
          // argümanlar değişkenden: aynı dosyada `const <ad> = { … }` tanımı varsa onun anahtarları (en kısa çağrı biçimi)
          const call = balanced(s, m.index + m[0].indexOf('('), '(', ')') ?? '';
          const ids = [...call.slice(call.indexOf(',') + 1).matchAll(/\b([a-z][A-Za-z0-9]*)\b/g)].map((x) => x[1]);
          const def = ids.map((id) => s.match(new RegExp(`const\\s+${id}\\s*=\\s*\\{`))).find(Boolean);
          if (def) topKeys(balanced(s, def.index + def[0].length - 1, '{', '}') ?? '').forEach((k) => args.add(k));
          else dynamic.add(name); // çözülemedi: yalnız işlevin varlığı denetlenir
        }
      }
      rpcs.set(name, args); note('rpc:' + name, f);
    }
    for (const m of s.matchAll(/(?<!storage)\.from\(\s*'([a-z_0-9]+)'\s*\)/g)) {
      const t = m[1];
      const cols = tables.get(t) ?? new Set();
      // zincirin devamı: bir sonraki .from( ya da ; ya da 400 karakter
      const rest = s.slice(m.index + m[0].length, m.index + m[0].length + 1200);
      const end = Math.min(...[rest.search(/\.from\(/), rest.search(/;\s*\n/), 1200].filter((x) => x >= 0));
      const chain = rest.slice(0, end);
      for (const sm of chain.matchAll(/\.select\(\s*'([^']*)'/g)) selectCols(sm[1]).forEach((c) => cols.add(c));
      for (const wm of chain.matchAll(/\.(insert|update|upsert)\(\s*\{/g)) {
        const i = wm.index + wm[0].length - 1;
        topKeys(balanced(chain, i, '{', '}') ?? '').forEach((k) => cols.add(k));
      }
      for (const fm of chain.matchAll(/\.(eq|neq|in|is|gt|gte|lt|lte|order|not|contains)\(\s*'([a-z_0-9]+)'/g)) cols.add(fm[2]);
      tables.set(t, cols); note('table:' + t, f);
    }
    for (const m of s.matchAll(/functions\/v1\/([a-z0-9-]+)/g)) fns.add(m[1]);
    for (const m of s.matchAll(/const\s+(?:MAIL_)?BUCKET\s*=\s*'([a-z0-9-]+)'/g)) buckets.add(m[1]);
  }
  return { rpcs, tables, fns, buckets, where, dynamic };
}

async function main() {
  const { rpcs, tables, fns, where, dynamic } = extract();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      rpcs: Object.fromEntries([...rpcs].map(([n, a]) => [n, { args: [...a], dynamic: dynamic.has(n), at: where.get('rpc:' + n) }])),
      tables: Object.fromEntries([...tables].map(([t, c]) => [t, { cols: [...c], at: where.get('table:' + t) }])),
      fns: [...fns],
    }, null, 1));
    return;
  }
  if (process.argv.includes('--list')) {
    for (const [n, a] of [...rpcs].sort()) console.log(`rpc   ${n}(${[...a].join(', ')})`);
    for (const [t, c] of [...tables].sort()) console.log(`table ${t}: ${[...c].join(', ')}`);
    console.log(`edge  ${[...fns].join(', ')}`);
    return;
  }
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
  const key = process.env.SUPABASE_KEY ?? '';
  const local = !!process.env.LOCAL;
  if (!url || (!key && !local)) { console.error('SUPABASE_URL ve SUPABASE_KEY gerekli (yerelde LOCAL=1)'); process.exit(2); }
  const H = { 'Content-Type': 'application/json', Accept: 'application/json', ...(key ? { apikey: key } : {}) };
  const bad = [], warn = [];
  const j = async (r) => { try { return await r.json(); } catch { return {}; } };

  for (const [name, args] of [...rpcs].sort()) {
    const body = Object.fromEntries([...args].map((a) => [a, null]));
    const r = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    const b = await j(r);
    const code = b.code ?? '';
    // PGRST202: o adla ve bu argümanlarla işlev yok. İpucu "public.<ad>(…)" diyorsa işlev başka argümanlarla var.
    const exists = code === 'PGRST202' && String(b.hint ?? '').includes(`public.${name}(`);
    if (code === 'PGRST202' && !(exists && dynamic.has(name))) bad.push(`${exists ? 'ARGÜMANLAR UYMUYOR' : 'İŞLEV YOK'}: ${name}(${[...args].join(', ')}) — ${where.get('rpc:' + name)} · ${b.hint ?? b.message ?? ''}`);
    else if (code === '42501' || r.status === 401 || r.status === 403) { /* var, girişsiz çalışmıyor: doğru */ }
    else if (!PUBLIC_OK.has(name)) warn.push(`girişsiz çalıştı (beklenmez): ${name} → ${r.status} ${code} ${b.message ?? ''}`.trim());
  }
  for (const [t, cols] of [...tables].sort()) {
    const sel = [...cols].join(',') || '*';
    const r = await fetch(`${url}/rest/v1/${t}?select=${encodeURIComponent(sel)}&limit=0`, { headers: H });
    const b = await j(r);
    const code = b.code ?? '';
    if (code === 'PGRST205' || code === '42P01') bad.push(`TABLO YOK: ${t} — ${where.get('table:' + t)}`);
    else if (code === '42703' || code === 'PGRST204' || code === 'PGRST200') bad.push(`SÜTUN/İLİŞKİ YOK: ${t} (${sel}) — ${b.message ?? ''}`);
    else if (r.status >= 500) bad.push(`TABLO hatası: ${t} → ${r.status} ${b.message ?? ''}`);
  }
  if (!local) {
    for (const f of [...fns].sort()) {
      const r = await fetch(`${url}/functions/v1/${f}`, { headers: H });
      const t = await r.text();
      if (r.status === 404 && /Requested function was not found/i.test(t)) bad.push(`EDGE FUNCTION YOK: ${f}`);
    }
    const r = await fetch(`${url}/auth/v1/settings`, { headers: H });
    const s = await j(r);
    if (!r.ok) bad.push(`giriş ayarları okunamadı: ${r.status}`);
    else {
      if (!s.external?.email) bad.push('GİRİŞ: e-posta ile kayıt kapalı (Authentication › Providers › Email)');
      if (s.disable_signup) bad.push('GİRİŞ: yeni kayıt kapalı (Authentication › Sign In / Providers › "Allow new users to sign up")');
      if (!s.external?.anonymous_users) bad.push('GİRİŞ: anonim giriş kapalı — Pofi Adası çocuk cihazını bağlayamaz (Authentication › Sign In / Providers › "Allow anonymous sign-ins")');
      console.log(`giriş ayarları: e-posta ${!!s.external?.email}, anonim ${!!s.external?.anonymous_users}, kayıt ${!s.disable_signup}, e-posta onayı ${s.mailer_autoconfirm ? 'kapalı (otomatik)' : 'açık'}`);
    }
  }
  console.log(`denetlenen: ${rpcs.size} işlev, ${tables.size} tablo${local ? '' : `, ${fns.size} Edge Function, giriş ayarları`}`);
  warn.forEach((w) => console.log('UYARI  ' + w));
  bad.forEach((x) => console.log('HATA   ' + x));
  if (bad.length) { console.log(`${bad.length} sorun`); process.exit(1); }
  console.log('TAMAM: uygulamanın çağırdığı her şey sunucuda var');
}
if (import.meta.url === `file://${process.argv[1]}`) main();
