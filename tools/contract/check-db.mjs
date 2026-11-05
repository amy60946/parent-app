#!/usr/bin/env node
// Sözleşme denetimi, veritabanı tarifine karşı (ortak/supabase/migrations uygulanmış bir PostgreSQL):
// uygulamanın çağırdığı her işlev (ad + argüman adları + zorunlu argümanlar), tablo ve sütun var mı ve
// girişli kullanıcı (authenticated) çalıştırabiliyor / okuyabiliyor mu? psql ile katalog sorgusu; satır yazmaz.
//   node tools/contract/check-db.mjs <psql bağlantısı, ör. "dbname=ortak">      (CI: ortak deposunun göçleriyle)
import { execFileSync } from 'node:child_process';
const conn = process.argv[2] ?? process.env.DATABASE_URL;
if (!conn) { console.error('bağlantı gerekli'); process.exit(2); }
const spec = JSON.parse(execFileSync('node', [new URL('./check.mjs', import.meta.url).pathname, '--json'], { encoding: 'utf8' }));
const q = (sql) => execFileSync('psql', [conn, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const funcs = JSON.parse(q(`select coalesce(json_agg(json_build_object('name', p.proname, 'args', coalesce(p.proargnames[1:p.pronargs], '{}'),
  'required', p.pronargs - p.pronargdefaults, 'exec', has_function_privilege('authenticated', p.oid, 'execute'))), '[]')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`) || '[]');
const cols = JSON.parse(q(`select coalesce(json_object_agg(t, c), '{}') from (select table_name t, json_agg(column_name::text) c
  from information_schema.columns where table_schema = 'public' group by table_name) x`) || '{}');
const bad = [];
for (const [name, r] of Object.entries(spec.rpcs)) {
  const cand = funcs.filter((f) => f.name === name);
  if (!cand.length) { bad.push(`İŞLEV YOK: ${name} — ${r.at}`); continue; }
  const fit = r.dynamic ? cand : cand.filter((f) => r.args.every((a) => f.args.includes(a)) && f.args.slice(0, f.required).every((a) => r.args.includes(a)));
  if (!fit.length) bad.push(`ARGÜMANLAR UYMUYOR: ${name}(${r.args.join(', ')}) — sunucuda: ${cand.map((f) => `(${f.args.join(', ')}; zorunlu ${f.required})`).join(' / ')} — ${r.at}`);
  else if (!fit.some((f) => f.exec)) bad.push(`YETKİ YOK: girişli kullanıcı ${name} çalıştıramıyor — ${r.at}`);
}
for (const [t, r] of Object.entries(spec.tables)) {
  if (!cols[t]) { bad.push(`TABLO YOK: ${t} — ${r.at}`); continue; }
  const miss = r.cols.filter((c) => !cols[t].includes(c));
  if (miss.length) bad.push(`SÜTUN YOK: ${t}.${miss.join(', ')} — ${r.at}`);
  if (q(`select has_table_privilege('authenticated', 'public.${t}', 'select')`) !== 't') bad.push(`YETKİ YOK: girişli kullanıcı ${t} okuyamıyor`);
}
console.log(`tarif denetimi: ${Object.keys(spec.rpcs).length} işlev, ${Object.keys(spec.tables).length} tablo`);
bad.forEach((b) => console.log('HATA   ' + b));
if (bad.length) { console.log(`${bad.length} sorun`); process.exit(1); }
console.log('TAMAM: uygulamanın çağırdığı her şey tarifte var ve girişli kullanıcıya açık');
