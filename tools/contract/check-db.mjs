#!/usr/bin/env node
// Sözleşme denetimi, veritabanı tarifine karşı (ortak/supabase/migrations uygulanmış bir PostgreSQL):
// uygulamanın çağırdığı her işlev (ad + argüman adları + zorunlu argümanlar), tablo ve sütun var mı ve
// girişli kullanıcı (authenticated) çalıştırabiliyor / okuyabiliyor mu? psql ile katalog sorgusu; satır yazmaz.
//   node tools/contract/check-db.mjs <psql bağlantısı, ör. "dbname=ortak">      (CI: ortak deposunun göçleriyle)
// Ortakta henüz uygulanmamış öneriler (supabase/proposed/) için ikinci bağlantı verilebilir:
//   node tools/contract/check-db.mjs "dbname=tarif" --pending "dbname=oneri"     (oneri = göçler + öneriler)
// Tarifte olmayıp öneride olan işlev/tablo hata değil "ÖNERİDE BEKLİYOR" uyarısıdır (SQL canlıya uygulanınca kalkar;
// canlı adımı o zamana dek kırmızı kalır). Öneride de olmayan ya da öneriyle uyuşmayan her şey yine hatadır.
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2);
const pi = args.indexOf('--pending');
const pendingConn = pi >= 0 ? args[pi + 1] : undefined;
const conn = args.filter((_, i) => i !== pi && i !== pi + 1)[0] ?? process.env.DATABASE_URL;
if (!conn) { console.error('bağlantı gerekli'); process.exit(2); }
const spec = JSON.parse(execFileSync('node', [new URL('./check.mjs', import.meta.url).pathname, '--json'], { encoding: 'utf8' }));

function audit(conn) {
  const q = (sql) => execFileSync('psql', [conn, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
  const funcs = JSON.parse(q(`select coalesce(json_agg(json_build_object('name', p.proname, 'args', coalesce(p.proargnames[1:p.pronargs], '{}'),
    'required', p.pronargs - p.pronargdefaults, 'exec', has_function_privilege('authenticated', p.oid, 'execute'))), '[]')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`) || '[]');
  const cols = JSON.parse(q(`select coalesce(json_object_agg(t, c), '{}') from (select table_name t, json_agg(column_name::text) c
    from information_schema.columns where table_schema = 'public' group by table_name) x`) || '{}');
  const bad = [];
  const add = (key, msg) => bad.push({ key, msg });
  for (const [name, r] of Object.entries(spec.rpcs)) {
    const cand = funcs.filter((f) => f.name === name);
    if (!cand.length) { add('rpc:' + name, `İŞLEV YOK: ${name} — ${r.at}`); continue; }
    const fit = r.dynamic ? cand : cand.filter((f) => r.args.every((a) => f.args.includes(a)) && f.args.slice(0, f.required).every((a) => r.args.includes(a)));
    if (!fit.length) add('rpc:' + name, `ARGÜMANLAR UYMUYOR: ${name}(${r.args.join(', ')}) — sunucuda: ${cand.map((f) => `(${f.args.join(', ')}; zorunlu ${f.required})`).join(' / ')} — ${r.at}`);
    else if (!fit.some((f) => f.exec)) add('rpc:' + name, `YETKİ YOK: girişli kullanıcı ${name} çalıştıramıyor — ${r.at}`);
  }
  for (const [t, r] of Object.entries(spec.tables)) {
    if (!cols[t]) { add('table:' + t, `TABLO YOK: ${t} — ${r.at}`); continue; }
    const miss = r.cols.filter((c) => !cols[t].includes(c));
    if (miss.length) add('table:' + t, `SÜTUN YOK: ${t}.${miss.join(', ')} — ${r.at}`);
    if (q(`select has_table_privilege('authenticated', 'public.${t}', 'select')`) !== 't') add('table:' + t + ':select', `YETKİ YOK: girişli kullanıcı ${t} okuyamıyor`);
  }
  return bad;
}

const found = audit(conn);
let bad = found, waiting = [];
if (pendingConn) {
  const after = audit(pendingConn);
  const still = new Set(after.map((b) => b.key));
  bad = [...found.filter((b) => still.has(b.key)), ...after.filter((b) => !found.some((x) => x.key === b.key))];
  waiting = found.filter((b) => !still.has(b.key));
}
console.log(`tarif denetimi: ${Object.keys(spec.rpcs).length} işlev, ${Object.keys(spec.tables).length} tablo`);
waiting.forEach((b) => console.log(`::warning::ÖNERİDE BEKLİYOR (SQL henüz uygulanmadı): ${b.msg}`));
bad.forEach((b) => console.log('HATA   ' + b.msg));
if (bad.length) { console.log(`${bad.length} sorun`); process.exit(1); }
console.log(waiting.length
  ? `TAMAM: uygulamanın çağırdığı her şey tarifte ya da ortaktaki öneride var (${waiting.length} öneride bekliyor; canlı adımı SQL uygulanınca yeşile döner)`
  : 'TAMAM: uygulamanın çağırdığı her şey tarifte var ve girişli kullanıcıya açık');
