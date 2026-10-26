// ÖNİZLEME İÇİN DENEME VERİTABANI
// Web önizlemesi derlenirken src/lib/supabase.ts yerine bu dosya kullanılır
// (bkz. preview/build.sh). Supabase istemcisinin uygulamada kullanılan kısmını
// taklit eder; veriler tarayıcıda (localStorage) saklanır. Uygulamanın
// gerçek sürümünde kullanılmaz.

import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>;
type Err = { message: string; code?: string } | null;
type Db = { users: Row[]; blobs: Record<string, string>; sessions: Record<string, Row | null> } & Record<string, any>;

// ParentApp ve ClinicApp önizlemeleri aynı sayfada (aynı tarayıcı deposunda) birlikte çalışabilir:
// veri ortak, oturum her uygulamaya ayrı. Uygulama adını paketleyici yazar (window.__PREVIEW_APP__).
const APP: string = (globalThis as any).__PREVIEW_APP__ ?? 'parent';
const KEY = 'pofi-onizleme-v9';
const TABLES = ['profiles', 'families', 'children', 'tasks', 'task_assignments', 'completions', 'messages', 'saved_templates', 'invite_codes',
  'clinics', 'clinicians', 'clinic_invites', 'clinic_links', 'clinic_notes', 'clinic_goals', 'goal_ratings', 'abc_events',
  'clinic_task_suggestions', 'family_subscriptions', 'notifications', 'push_tokens', 'rewards', 'reward_requests', 'sun_stone_ledger',
  'care_modules', 'care_module_logs', 'clinic_link_history'];

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
const now = () => new Date().toISOString();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const ago = (min: number) => new Date(Date.now() - min * 60e3).toISOString();

/* ---------- Örnek aile ---------- */

function seed(): Db {
  const U = 'demo-user', F = 'demo-family';
  const db: Db = { users: [], blobs: {}, sessions: {} };
  TABLES.forEach((t) => { db[t] = []; });
  db.users.push({ id: U, email: 'demo@parentapp.app', password: '12345678' });
  db.families.push({ id: F, name: 'Ailem', created_at: now(), trial_started_at: ago(2 * 1440) });
  // Abonelik anahtarı (sunucuda app_config.billing). Önizlemede tarayıcı konsolundan değiştirilebilir.
  db.billing = { enforce: false, trial_days: 7, free_max_tasks: 3, free_max_children: 1 };
  db.profiles.push({ id: U, family_id: F, nickname: 'Anne', name: 'Ayşe', avatar: 'kadın', created_at: now() });
  db.children.push(
    { id: 'c-nazli', family_id: F, name: 'Nazlı', avatar: 'flamingo', gender: 'kız', birthday: '2018-04-12', age_band: 'A', user_id: 'demo-child', coins_spent: 15, created_at: ago(9000) },
    { id: 'c-arven', family_id: F, name: 'Arven', avatar: 'keçi', gender: 'erkek', birthday: '2020-09-03', user_id: null, created_at: ago(8000) },
  );
  const task = (id: string, title: string, emoji: string, skill: string, start: number, recurring: boolean, reminder: string | null, review: boolean, kids: [string, string, number][]) => {
    db.tasks.push({
      id, family_id: F, title, emoji, skill, description: '', start_date: day(start), recurring, end_date: null, reminder,
      requires_review: review, created_at: ago(5000 - db.tasks.length), repeat_kind: 'daily', repeat_days: [], sort_order: db.tasks.length,
    });
    kids.forEach(([child_id, difficulty, coins]) => db.task_assignments.push({ task_id: id, child_id, family_id: F, difficulty, coins }));
  };
  task('k-yatak', 'Yatağını topla', '🛏️', 'Takım Çalışması', -14, true, '08:00', true, [['c-nazli', 'easy', 5], ['c-arven', 'easy', 5]]);
  task('k-kitap', '10 dakika kitap oku', '📖', 'Odaklanma', -10, true, null, true, [['c-nazli', 'medium', 10]]);
  task('k-dis', 'Dişlerini fırçala', '🪥', 'Öz Bakım', -20, true, '21:00', false, [['c-nazli', 'easy', 5], ['c-arven', 'easy', 5]]);
  task('k-cicek', 'Çiçekleri sula', '🪴', 'Sorumluluk', 0, false, null, true, [['c-arven', 'easy', 5]]);
  // Çocuğun "Yaptım" dediği an: görevin hatırlatma saatine göre biraz önce ya da sonra
  const at = (d: number, hhmm: string, jitterMin: number) => {
    const [h, m] = hhmm.split(':').map(Number);
    const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m + jitterMin, 0, 0);
    return x.toISOString();
  };
  const done = (task_id: string, child_id: string, d: number, status = 'approved', hhmm = '18:00', jitter = 0, decline_reason: string | null = null) =>
    db.completions.push({
      id: uuid(), family_id: F, task_id, child_id, date: day(d), status, created_at: now(),
      child_done_at: at(d, hhmm, jitter), decline_reason,
    });
  done('k-dis', 'c-nazli', 0, 'approved', '21:00', -10);
  done('k-yatak', 'c-nazli', 0, 'pending', '08:00', 15);
  done('k-kitap', 'c-nazli', -1, 'pending', '19:00', 0);
  // Nazlı: ilk haftalarda düzensiz, son haftalarda belirgin şekilde daha düzenli (uzman paneli grafikleri için)
  for (let n = 1; n <= 56; n++) {
    const early = n > 28;
    const r = (n * 37) % 100; // tekrarlanabilir sözde rastgele
    if (!early || r < 60) done('k-dis', 'c-nazli', -n, 'approved', '21:00', (r % 50) - 20);
    if (r < (early ? 35 : 75)) done('k-yatak', 'c-nazli', -n, 'approved', '08:00', (r % 130) - 30);
    if (n <= 10 && r < 70) done('k-kitap', 'c-nazli', -n, 'approved', '19:00', r % 60);
    else if (n <= 10) done('k-kitap', 'c-nazli', -n, 'declined', '19:00', 0, n % 2 ? 'hard' : 'no_time');
    if (n <= 12 && n % 3) done('k-dis', 'c-arven', -n);
  }
  const msg = (child_id: string, sender: string, body: string, min: number) =>
    db.messages.push({ id: uuid(), family_id: F, child_id, sender, sender_id: sender === 'parent' ? U : null, kind: 'text', body, media_path: null, duration_ms: null, created_at: ago(min) });
  msg('c-nazli', 'parent', 'Bugün kitabını okudun mu?', 180);
  msg('c-nazli', 'child', 'Evet anne, 2 bölüm okudum!', 150);
  msg('c-nazli', 'parent', 'Harikasın! Akşam birlikte devam edelim.', 140);
  db.saved_templates.push({ id: uuid(), family_id: F, template_key: 't1', is_custom: false, saved: true, created_at: now() });
  db.messages.push({ id: uuid(), family_id: F, child_id: 'c-nazli', sender: 'child', sender_id: 'demo-child', kind: 'sticker', body: 'love_you', media_path: null, duration_ms: null, created_at: ago(20), read_at: null });
  db.messages.forEach((m: Row) => { if (m.sender === 'parent' || m.created_at < ago(100)) m.read_at = m.read_at ?? ago(90); });

  // Güneş Taşı ve ödüller
  const stone = (child_id: string, amount: number, reason: string, min: number, note: string | null = null) =>
    db.sun_stone_ledger.push({ id: db.sun_stone_ledger.length + 1, family_id: F, child_id, amount, reason, ref: uuid(), note, created_at: ago(min) });
  [3, 1, 2, 1, 1, 2, 1, 3, 1, 1].forEach((n, i) => stone('c-nazli', n, 'task', 6000 - i * 500));
  stone('c-nazli', -5, 'reward', 2000, 'Parkta 30 dakika');
  stone('c-nazli', -1, 'penalty', 900, 'Kardeşiyle kavga');
  stone('c-nazli', 2, 'task', 60);
  [1, 1, 1, 2].forEach((n, i) => stone('c-arven', n, 'task', 3000 - i * 400));
  const rw = (id: string, title: string, cost: number, icon: string, child_ids: string[] = [], unit: string | null = null, unit_amount: number | null = null) =>
    db.rewards.push({ id, family_id: F, title, kind: unit ? 'exchange' : 'item', cost, unit, unit_amount, child_ids, icon, active: true, created_at: ago(7000 - db.rewards.length) });
  rw('r-ekran', 'Ekran süresi', 1, 'phone-portrait', [], 'minute', 10);
  rw('r-park', 'Parkta 30 dakika', 5, 'football');
  rw('r-film', 'Film gecesi', 12, 'film');
  rw('r-bisiklet', 'Bisiklet turu', 20, 'bicycle', ['c-arven']);
  db.reward_requests.push({ id: 'rq-1', family_id: F, child_id: 'c-nazli', reward_id: 'r-film', title: 'Film gecesi', cost: 12, source: 'child', status: 'pending', note: null, created_at: ago(35) });
  // Tekrarlayan görevlerin başlangıcı 8 haftalık geçmişe yayılır (uzman paneli)
  db.tasks.forEach((t: Row) => { if (t.recurring && t.id !== 'k-kitap') t.start_date = day(-60); });

  // Örnek klinik: uzman hesabı + Nazlı için ebeveyn rızası
  const K = 'demo-clinic', D = 'demo-clinician', L = 'demo-link';
  db.users.push({ id: D, email: 'uzman@clinicapp.app', password: '12345678' });
  db.clinics.push({ id: K, name: 'Mavi Çocuk ve Aile Merkezi', plan: 'trial', seat_limit: 3, trial_ends_at: new Date(Date.now() + 11 * 864e5).toISOString(), created_by: D, created_at: ago(5 * 1440) });
  db.clinicians.push({ id: D, clinic_id: K, name: 'Dr. Elif Kaya', title: 'Klinik Psikolog', role: 'owner', created_at: ago(5 * 1440) });
  db.clinicians.push({ id: 'demo-clinician-2', clinic_id: K, name: 'Mert Aydın', title: 'Ergoterapist', role: 'member', created_at: ago(4 * 1440) });
  db.clinic_links.push({ id: L, clinic_id: K, clinician_id: D, family_id: F, child_id: 'c-nazli', label: 'Sabah rutini', status: 'active', consent_by: U, consent_at: ago(40 * 1440), revoked_at: null, created_at: ago(40 * 1440) });
  // Uzman daveti önizlemesi (20261026100000_family_invite_links.sql): paylaşılan hedefler + aile programı, önceki uzman,
  // bu aileye bağlanmış bekleyen davet (çocuk önerisi: Efe, 6–8)
  const K2 = 'demo-clinic-2', D2 = 'demo-clinician-3', K0 = 'demo-clinic-0';
  db.clinics.push({ id: K2, name: 'Deniz Gelişim Merkezi', plan: 'trial', seat_limit: 3, trial_ends_at: new Date(Date.now() + 11 * 864e5).toISOString(), created_by: D2, created_at: ago(3 * 1440) });
  db.clinicians.push({ id: D2, clinic_id: K2, name: 'Dr. Can Demir', title: 'Çocuk Gelişimci', role: 'owner', created_at: ago(3 * 1440) });
  db.clinics.push({ id: K0, name: 'Eski Klinik', plan: 'trial', seat_limit: 3, trial_ends_at: ago(30 * 1440), created_by: 'demo-clinician-0', created_at: ago(300 * 1440) });
  db.clinic_links.push({ id: 'demo-link-0', clinic_id: K0, clinician_id: 'demo-clinician-0', family_id: F, child_id: 'c-nazli', label: '', status: 'revoked', consent_by: U, consent_at: ago(200 * 1440), revoked_at: ago(60 * 1440), created_at: ago(200 * 1440) });
  db.clinic_invites.push({ code: 'DVT7K2', token: '0123456789abcdef0123456789abcdef', kind: 'family', clinic_id: K2, clinician_id: D2, label: '', child_name: 'Efe', child_age_group: 'A',
    created_at: ago(60), expires_at: new Date(Date.now() + 47 * 3600e3).toISOString(), used_at: null, used_by: null, claimed_at: ago(30), claimed_family: F, revoked_at: null });
  db.care_modules.push(
    { id: 'm-rutin', link_id: L, clinic_id: K, title: 'Görsel sabah rutini', aim: 'Sabah adımlarını hatırlatmasız başlatmak.', practice: 'Kartları sırayla göster, her adımdan sonra kısaca öv.', checklist: ['Kartları göz hizasına astım', 'Yalnız kartı gösterdim, sözle tekrar etmedim', 'Bitince birlikte kutladık'], status: 'active', position: 0, created_at: ago(30 * 1440) },
    { id: 'm-gecis', link_id: L, clinic_id: K, title: 'Ekran kapatma geçişi', aim: 'Ekran sonrası geçişi sakin yapmak.', practice: '5 dakika önce haber ver, zamanlayıcıyı birlikte kurun.', checklist: ['5 dakika önce haber verdim', 'Zamanlayıcıyı birlikte kurduk'], status: 'active', position: 1, created_at: ago(30 * 1440) },
  );
  db.care_module_logs.push({ id: uuid(), module_id: 'm-rutin', family_id: F, day: day(-1), practiced: true, difficulty: 3, barrier: null, created_by: U, created_at: ago(1440) },
    { id: uuid(), module_id: 'm-rutin', family_id: F, day: day(-2), practiced: true, difficulty: 2, barrier: null, created_by: U, created_at: ago(2880) });
  const monday = (w: number) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * w); return iso(d); };
  db.clinic_goals.push(
    { id: 'g-sabah', link_id: L, clinic_id: K, title: 'Sabah rutinini hatırlatmasız başlatır', description: '-2: hiç başlatmaz · 0: haftada 3 gün · +2: her gün', archived: false, created_by: D, created_at: ago(40 * 1440),
      shared: true, status: 'active', target: 'Haftada 5 gün', home_support: 'Kart panosunu kapının yanına as; adımı yalnız kartla göster.' },
    { id: 'g-gecis', link_id: L, clinic_id: K, title: 'Ekran kapatma geçişinde sakin kalır', description: '-2: her geçişte kriz · 0: haftada 1–2 · +2: hiç', archived: false, created_by: D, created_at: ago(40 * 1440) },
  );
  [-2, -1, -1, 0, 0, 1].forEach((r, i) => db.goal_ratings.push({ goal_id: 'g-sabah', clinic_id: K, week: monday(5 - i), rating: r, note: '', rated_by: D, created_at: now() }));
  [-1, -1, 0, 0, 1, 1].forEach((r, i) => db.goal_ratings.push({ goal_id: 'g-gecis', clinic_id: K, week: monday(5 - i), rating: r, note: '', rated_by: D, created_at: now() }));
  db.clinic_notes.push(
    { id: uuid(), link_id: L, clinic_id: K, author_id: D, body: 'İlk görüşme. Aile sabah rutini ve ekran geçişlerinde zorlandığını belirtti. Hedefler birlikte belirlendi.', created_at: ago(40 * 1440) },
    { id: uuid(), link_id: L, clinic_id: K, author_id: D, body: 'Yatak toplama hatırlatmayla düzenli hale geliyor. Kitap okumada "zor" yanıtları var; süre 5 dakikaya inebilir.', created_at: ago(9 * 1440) },
  );
  const abc = (d: number, a: string, b: string, c: string, intensity: number) =>
    db.abc_events.push({ id: uuid(), family_id: F, child_id: 'c-nazli', occurred_at: at(-d, '19:30', 0), antecedent: a, behavior: b, consequence: c, intensity, day_part: 'evening', group_id: null, created_by: U, created_at: now() });
  abc(38, 'Tablet süresi bitti', 'Ağladı, tableti bırakmadı', 'Tablet elinden alındı', 5);
  abc(33, 'Tablet süresi bitti', 'Bağırdı, kapıyı çarptı', 'Odasına gitti', 4);
  abc(27, 'Ödev zamanı geldi', 'Masaya oturmayı reddetti', 'Ödev ertelendi', 3);
  abc(20, 'Tablet süresi bitti', 'Söylendi ama kapattı', 'Övgü aldı', 2);
  abc(12, 'Tablet süresi bitti', 'Biraz itiraz etti, 2 dakikada kapattı', 'Birlikte oyun oynandı', 2);
  abc(4, 'Kardeşi oyuncağını aldı', 'Kardeşine vurdu', 'Sakinleşme köşesine gitti', 3);
  db.clinic_task_suggestions.push({
    id: uuid(), link_id: L, clinic_id: K, family_id: F, child_id: 'c-nazli', title: 'Kıyafetini akşamdan hazırla', emoji: '👕',
    skill: 'Planlama', difficulty: 'easy', recurring: true, note: 'Sabah rutinini kısaltmak için.', status: 'pending', created_by: D, created_at: ago(300), decided_at: null,
    description: 'Yatmadan önce yarın giyeceklerini sandalyeye hazırla.', coins: 8, repeat_kind: 'weekly', repeat_days: [1, 2, 3, 4, 5], reminder: '19:30', requires_review: true,
  });

  // Örnek bildirimler (gerçekte sunucu tetikleyicileri yazar)
  const note = (id: number, kind: string, title: string, body: string, min: number, data: Row, read = false) =>
    db.notifications.push({ id, user_id: U, app: 'parent', kind, title, body, data, child_id: data.child_id ?? null, created_at: ago(min), read_at: read ? ago(min - 1) : null });
  note(1, 'clinic_suggestion', 'Uzmanın Nazlı için görev önerdi', '👕 Kıyafetini akşamdan hazırla', 300, { child_id: 'c-nazli' });
  note(2, 'task_done', 'Nazlı görevi yaptı: 10 dakika kitap oku', 'Onayını bekliyor.', 45, { child_id: 'c-nazli', task_id: 'k-kitap' });
  note(3, 'message', 'Nazlı mesaj gönderdi', 'Anne bugün çok eğlendim!', 1500, { child_id: 'c-nazli' }, true);
  note(4, 'reward_request', 'Nazlı bir ödül istiyor', 'Film gecesi · 12 Güneş Taşı', 35, { child_id: 'c-nazli', request_id: 'rq-1' });
  note(5, 'message', 'Nazlı mesaj gönderdi', 'Çıkartma gönderdi', 20, { child_id: 'c-nazli' });

  // İki uygulama aynı anda ilk kez açılabilir: hangisi kurarsa kursun her ikisinin hazır oturumu olsun
  db.sessions = {
    clinic: { user: { id: D, email: 'uzman@clinicapp.app' }, access_token: 'demo' },
    parent: { user: { id: U, email: 'demo@parentapp.app' }, access_token: 'demo' },
  };
  return db;
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const x = JSON.parse(raw);
      TABLES.forEach((t) => { x[t] = x[t] ?? []; });
      x.sessions = x.sessions ?? {};
      return x;
    }
  } catch { /* depolama kapalıysa her açılışta örnek aile */ }
  return seed();
}

let db = load();
// Aynı sayfadaki öteki uygulama yazmış olabilir: her işlemden önce depodan tazele
const sync = () => {
  try { if (localStorage.getItem(KEY)) db = load(); } catch { /* yok say */ }
};
const sess = () => db.sessions[APP] ?? null;
const setSess = (s: Row | null) => { db.sessions[APP] = s; };
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* sığmazsa (ör. büyük fotoğraflar) yalnızca bu oturumda kalır */ }
};

/* ---------- Tablo sorguları ---------- */

const PK: Record<string, string[]> = {
  task_assignments: ['task_id', 'child_id'],
  completions: ['task_id', 'child_id', 'date'],
  invite_codes: ['code'],
  clinic_invites: ['code'],
  goal_ratings: ['goal_id', 'week'],
  family_subscriptions: ['family_id'],
};

function cascade(table: string, removed: Row[]) {
  const ids = new Set(removed.map((r) => r.id));
  if (table === 'tasks') {
    ['task_assignments', 'completions'].forEach((t) => { db[t] = db[t].filter((r: Row) => !ids.has(r.task_id)); });
  }
  if (table === 'children') {
    ['task_assignments', 'completions', 'messages', 'invite_codes'].forEach((t) => { db[t] = db[t].filter((r: Row) => !ids.has(r.child_id)); });
  }
  if (table === 'families') {
    TABLES.filter((t) => t !== 'families' && t !== 'profiles').forEach((t) => { db[t] = db[t].filter((r: Row) => !ids.has(r.family_id)); });
    db.profiles.forEach((p: Row) => { if (ids.has(p.family_id)) p.family_id = null; });
  }
  if (table === 'clinic_goals') db.goal_ratings = db.goal_ratings.filter((r: Row) => !ids.has(r.goal_id));
}

// Ücretsiz plan sınırları (sunucudaki tetikleyicilerle aynı); yalnız ödeme anahtarı açık ve deneme bitmişse
function premiumBlock(table: string, adding: number): { message: string; hint: string } | null {
  const me = db.profiles.find((p: Row) => p.id === db.sessions[APP]?.user.id);
  const fam = db.families.find((f: Row) => f.id === me?.family_id);
  const cfg = { enforce: false, trial_days: 7, free_max_tasks: 3, free_max_children: 1, ...(db.billing ?? {}) };
  if (!fam || !cfg.enforce) return null;
  const sub = db.family_subscriptions.find((x: Row) => x.family_id === fam.id);
  if (sub?.plan === 'premium' && (!sub.period_end || sub.period_end > now())) return null;
  if (fam.trial_started_at && new Date(fam.trial_started_at).getTime() + cfg.trial_days * 864e5 > Date.now()) return null;
  const today = iso(new Date());
  if (table === 'tasks') {
    const n = db.tasks.filter((t: Row) => t.family_id === fam.id && (!t.end_date || t.end_date >= today) && (t.recurring || t.start_date >= today)).length;
    return n + adding > cfg.free_max_tasks ? { message: `Ücretsiz planda en çok ${cfg.free_max_tasks} etkin görev olabilir`, hint: 'premium_required' } : null;
  }
  if (table === 'children') {
    const n = db.children.filter((c: Row) => c.family_id === fam.id).length;
    return n + adding > cfg.free_max_children ? { message: `Ücretsiz planda en çok ${cfg.free_max_children} çocuk eklenebilir`, hint: 'premium_required' } : null;
  }
  return { message: 'Bu özellik Premium üyelikte', hint: 'premium_required' };
}

class Query implements PromiseLike<{ data: any; error: Err; count?: number }> {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: any;
  private cols = '*';
  private one = false;
  private head = false;
  private conflict?: string[];

  constructor(private table: string) {}

  select(cols = '*', opts?: { head?: boolean }) { this.cols = cols; if (opts?.head) this.head = true; return this; }
  eq(k: string, v: any) { this.filters.push((r) => r[k] === v); return this; }
  match(m: Row) { Object.entries(m).forEach(([k, v]) => this.eq(k, v)); return this; }
  neq(k: string, v: any) { this.filters.push((r) => r[k] !== v); return this; }
  in(k: string, vals: any[]) { this.filters.push((r) => vals.includes(r[k])); return this; }
  gte(k: string, v: any) { this.filters.push((r) => String(r[k] ?? '') >= String(v)); return this; }
  lte(k: string, v: any) { this.filters.push((r) => String(r[k] ?? '') <= String(v)); return this; }
  limit() { return this; }
  not(k: string, _op: string, list: string) {
    const vals = list.replace(/[()]/g, '').split(',');
    this.filters.push((r) => !vals.includes(String(r[k])));
    return this;
  }
  order() { return this; }
  maybeSingle() { this.one = true; return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p: any, o?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.conflict = o?.onConflict?.split(','); return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }

  private run() {
    sync();
    const rows: Row[] = db[this.table] ?? (db[this.table] = []);
    const hit = (r: Row) => this.filters.every((f) => f(r));
    if (this.op === 'select') {
      let out = rows.filter(hit).map((r) => ({ ...r }));
      if (this.table === 'tasks' && this.cols.includes('task_assignments(')) {
        out = out.map((t) => ({ ...t, task_assignments: db.task_assignments.filter((a: Row) => a.task_id === t.id) }));
      }
      out.sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
      if (this.head) return { data: null, error: null, count: out.length };
      return { data: this.one ? out[0] ?? null : out, error: null, count: out.length };
    }
    if ((this.op === 'insert') && ['tasks', 'children', 'rewards', 'messages', 'abc_events'].includes(this.table)) {
      const blocked = premiumBlock(this.table, Array.isArray(this.payload) ? this.payload.length : 1);
      if (blocked) return { data: null, error: blocked };
    }
    if (this.op === 'insert' || this.op === 'upsert') {
      const list: Row[] = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => ({
        ...(PK[this.table] ? {} : { id: uuid() }), created_at: now(), ...r,
      }));
      const key = this.conflict ?? PK[this.table] ?? ['id'];
      for (const r of list) {
        const i = rows.findIndex((x) => key.every((k) => x[k] === r[k]));
        if (i >= 0 && this.op === 'upsert') rows[i] = { ...rows[i], ...r };
        else if (i >= 0) return { data: null, error: { message: 'Bu kayıt zaten var.' } };
        else rows.push(r);
      }
    }
    if (this.op === 'update') rows.filter(hit).forEach((r) => Object.assign(r, this.payload));
    if (this.op === 'delete') {
      const removed = rows.filter(hit);
      db[this.table] = rows.filter((r) => !hit(r));
      cascade(this.table, removed);
    }
    save();
    return { data: null, error: null };
  }

  then<A = any, B = never>(ok?: ((v: any) => A | PromiseLike<A>) | null, fail?: ((e: any) => B | PromiseLike<B>) | null) {
    return new Promise((r) => setTimeout(r, 60)).then(() => this.run()).then(ok, fail);
  }
}

/* ---------- Oturum ---------- */

type Listener = (event: string, session: Row | null) => void;
const listeners: Listener[] = [];
const emit = (event: string) => listeners.forEach((l) => l(event, sess()));
const fail = (message: string, code?: string) => ({ data: { session: null, user: null }, error: { message, code } });
const myProfile = () => db.profiles.find((p: Row) => p.id === sess()?.user.id);
const myClinician = () => db.clinicians.find((m: Row) => m.id === sess()?.user.id);

function newFamilyFor(userId: string, name: string) {
  const fid = uuid();
  db.families.push({ id: fid, name: 'Ailem', created_at: now(), trial_started_at: now() });
  db.profiles.push({ id: userId, family_id: fid, nickname: 'Ben', name, avatar: 'erkek', created_at: now() });
}

const auth = {
  async getSession() { sync(); return { data: { session: sess() }, error: null }; },
  onAuthStateChange(cb: Listener) {
    listeners.push(cb);
    return { data: { subscription: { unsubscribe() { listeners.splice(listeners.indexOf(cb), 1); } } } };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    sync();
    const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) return fail('Invalid login credentials', 'invalid_credentials');
    setSess({ user: { id: u.id, email: u.email }, access_token: 'demo' });
    save(); emit('SIGNED_IN');
    return { data: { session: sess() }, error: null };
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Row } }) {
    sync();
    if (db.users.some((x) => x.email.toLowerCase() === email.toLowerCase())) return fail('User already registered', 'user_already_exists');
    const id = uuid();
    const meta = options?.data ?? {};
    // Sunucudaki handle_new_user ile aynı: uzman hesabı aile açmaz, klinik açar ya da ekibe katılır
    if (meta.account === 'clinician') {
      let cid: string;
      let role = 'owner';
      if (String(meta.team_code ?? '').trim()) {
        const inv = db.clinic_invites.find((i: Row) => i.code === String(meta.team_code).trim().toUpperCase() && i.kind === 'clinician' && !i.used_at && i.expires_at > now());
        if (!inv) return fail('Ekip kodu geçersiz ya da süresi dolmuş');
        const clinic = db.clinics.find((c: Row) => c.id === inv.clinic_id);
        if (db.clinicians.filter((m: Row) => m.clinic_id === inv.clinic_id).length >= clinic.seat_limit) return fail('Kliniğin uzman koltuğu dolu');
        inv.used_at = now(); inv.used_by = id;
        cid = inv.clinic_id; role = 'member';
      } else {
        cid = uuid();
        db.clinics.push({ id: cid, name: String(meta.clinic_name || 'Kliniğim'), plan: 'trial', seat_limit: 3, trial_ends_at: new Date(Date.now() + 14 * 864e5).toISOString(), created_by: id, created_at: now() });
      }
      db.clinicians.push({ id, clinic_id: cid, name: meta.name ?? '', title: meta.title ?? '', role, created_at: now() });
    } else {
      newFamilyFor(id, meta.name ?? '');
    }
    db.users.push({ id, email, password });
    setSess({ user: { id, email }, access_token: 'demo' });
    save(); emit('SIGNED_IN');
    return { data: { session: sess(), user: sess()!.user }, error: null };
  },
  async signInAnonymously() {
    const id = uuid();
    db.users.push({ id, email: '', password: '', anonymous: true });
    setSess({ user: { id, email: null, is_anonymous: true }, access_token: 'demo' });
    save(); emit('SIGNED_IN');
    return { data: { session: sess() }, error: null };
  },
  async signOut() { sync(); setSess(null); save(); emit('SIGNED_OUT'); return { error: null }; },
  async updateUser({ password }: { password?: string }) {
    const u = db.users.find((x) => x.id === sess()?.user.id);
    if (u && password) u.password = password;
    save();
    return { data: {}, error: null };
  },
  async resetPasswordForEmail() { return { data: {}, error: null }; },
  async resend() { return { data: {}, error: null }; },
  async setSession() { return { data: {}, error: null }; },
  async verifyOtp() { return { data: {}, error: null }; },
  async exchangeCodeForSession() { return { data: {}, error: null }; },
  startAutoRefresh() {},
  stopAutoRefresh() {},
};

/* ---------- Sunucu fonksiyonları ---------- */

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

async function rpc(name: string, args: Row = {}): Promise<{ data: any; error: Err }> {
  await new Promise((r) => setTimeout(r, 120));
  sync();
  const me = myProfile();
  const uid = sess()?.user.id;
  if (!uid) return { data: null, error: { message: 'Önce giriş yapmalısın' } };
  // Uzaktan ayar: önizlemede localStorage 'demo-client-config' ile denenir
  if (name === 'client_config') {
    let cfg: any = { app: {}, flags: {} };
    try { cfg = JSON.parse(localStorage.getItem('demo-client-config') || 'null') ?? cfg; } catch {}
    return { data: cfg, error: null };
  }
  if (name === 'create_invite_code') {
    if (!me?.family_id) return { data: null, error: { message: 'Önce giriş yapmalısın' } };
    if (args.p_kind === 'child') db.invite_codes.forEach((i: Row) => { if (i.child_id === args.p_child_id && !i.used_at && i.expires_at > now()) i.expires_at = now(); });
    const row = {
      code: makeCode(), family_id: me.family_id, kind: args.p_kind ?? 'parent', child_id: args.p_child_id ?? null,
      created_by: uid, created_at: now(), expires_at: new Date(Date.now() + 15 * 60e3).toISOString(), used_at: null,
    };
    db.invite_codes.push(row);
    save();
    return { data: [{ code: row.code, expires_at: row.expires_at }], error: null };
  }
  // Kod hataları sunucudaki gibi: süresi doldu / kullanıldı / bulunamadı (ortak/sozlesme/durumlar.md 11)
  const codeErr = (inv: Row | undefined) => {
    const hint = !inv ? 'code_invalid' : inv.used_at ? 'code_used' : inv.expires_at <= now() ? 'code_expired' : null;
    if (!hint) return null;
    const message = hint === 'code_expired' ? 'Kodun süresi doldu (kodlar 15 dakika geçerli). Yeni kod iste.'
      : hint === 'code_used' ? 'Bu kod daha önce kullanıldı. Yeni kod iste.' : 'Kod bulunamadı. Harfleri kontrol et ya da yeni kod iste.';
    return { data: null, error: { message, hint, code: 'P0001' } };
  };
  if (name === 'redeem_child_code') {
    const inv = db.invite_codes.find((i: Row) => i.code === String(args.p_code).trim().toUpperCase() && i.kind === 'child');
    const bad = codeErr(inv);
    if (bad) return bad;
    const c = db.children.find((x: Row) => x.id === inv.child_id);
    db.children.forEach((x: Row) => { if (x.user_id === uid) x.user_id = null; });
    c.user_id = uid;
    inv.used_at = now(); inv.used_by = uid;
    save();
    return { data: { child_id: c.id, family_id: c.family_id, name: c.name, avatar: c.avatar }, error: null };
  }
  // Pofi Adası (M4) fonksiyonları: yaş bandı, ret + not, coin bakiyesi, cihaz bağlantısı
  const myChild = (id: string) => db.children.find((x: Row) => x.id === id && x.family_id === me?.family_id);
  if (name === 'set_child_age_band') {
    const c = myChild(args.p_child_id);
    if (!c) return { data: null, error: { message: 'Çocuk bulunamadı' } };
    c.age_band = args.p_band;
    save();
    return { data: null, error: null };
  }
  if (name === 'review_completion') {
    const key = { task_id: args.p_task_id, child_id: args.p_child_id, date: args.p_date };
    let row = db.completions.find((r: Row) => r.task_id === key.task_id && r.child_id === key.child_id && r.date === key.date);
    if (!row) { row = { id: uuid(), family_id: me.family_id, ...key, created_at: now() }; db.completions.push(row); }
    Object.assign(row, { status: args.p_status, parent_note: args.p_note ?? null, reviewed_at: now(), reviewed_by: uid });
    save();
    return { data: null, error: null };
  }
  if (name === 'child_balance') {
    const c = myChild(args.p_child_id);
    if (!c) return { data: null, error: { message: 'Yetki yok' } };
    const earned = db.completions
      .filter((r: Row) => r.child_id === c.id && r.status === 'approved')
      .reduce((sum: number, r: Row) => sum + (db.task_assignments.find((a: Row) => a.task_id === r.task_id && a.child_id === c.id)?.coins ?? 0), 0);
    return { data: earned - (c.coins_spent ?? 0), error: null };
  }
  if (name === 'unlink_child_device') {
    const c = myChild(args.p_child_id);
    if (!c) return { data: null, error: { message: 'Çocuk bulunamadı' } };
    c.user_id = null;
    save();
    return { data: null, error: null };
  }
  if (name === 'join_family') {
    const inv = db.invite_codes.find((i: Row) => i.code === String(args.p_code).trim().toUpperCase() && i.kind === 'parent');
    const bad = codeErr(inv);
    if (bad) return bad;
    if (inv.family_id === me.family_id) return { data: null, error: { message: 'Zaten bu ailedesin' } };
    const old = me.family_id;
    me.family_id = inv.family_id;
    inv.used_at = now(); inv.used_by = uid;
    if (old && !db.profiles.some((p: Row) => p.family_id === old)) {
      const fam = db.families.filter((f: Row) => f.id === old);
      db.families = db.families.filter((f: Row) => f.id !== old);
      cascade('families', fam);
    }
    save();
    return { data: { family_id: inv.family_id }, error: null };
  }
  if (name === 'delete_account') {
    const fid = me?.family_id;
    db.profiles = db.profiles.filter((p: Row) => p.id !== uid);
    if (fid && !db.profiles.some((p: Row) => p.family_id === fid)) {
      const fam = db.families.filter((f: Row) => f.id === fid);
      db.families = db.families.filter((f: Row) => f.id !== fid);
      cascade('families', fam);
    }
    db.users = db.users.filter((u) => u.id !== uid);
    save();
    return { data: null, error: null };
  }
  // Klinik (ClinicApp) fonksiyonları: sunucudaki 20261019000000_clinic.sql ile aynı kurallar
  const err = (message: string) => ({ data: null, error: { message } });
  const clinicActive = (id: string) => {
    const c = db.clinics.find((x: Row) => x.id === id);
    return !!c && (['small', 'business', 'custom'].includes(c.plan) || (c.plan === 'trial' && c.trial_ends_at > now()));
  };
  // Bu çocuğun bu paylaşımdan önce başka bir klinikle paylaşımı var mı (önceki uzman kayıtları)
  const hasHistory = (l: Row) => db.clinic_links.some((o: Row) => o.child_id === l.child_id && o.clinic_id !== l.clinic_id && o.consent_at <= l.consent_at);
  const anyInvite = (code: string, kind: string) =>
    db.clinic_invites.find((i: Row) => i.code === String(code ?? '').trim().toUpperCase() && i.kind === kind);
  const openInvite = (code: string, kind: string) => {
    const i = anyInvite(code, kind);
    return i && !codeErr(i) ? i : undefined;
  };
  if (name === 'clinician_me') {
    const m = myClinician();
    if (!m) return { data: null, error: null };
    const c = db.clinics.find((x: Row) => x.id === m.clinic_id);
    return { data: { id: m.id, name: m.name, title: m.title, role: m.role, clinic_id: c.id, clinic: c.name, plan: c.plan, seat_limit: c.seat_limit, trial_ends_at: c.trial_ends_at, active: clinicActive(c.id) }, error: null };
  }
  if (name === 'clinic_create_invite') {
    const m = myClinician();
    if (!m) return err('Yalnızca uzman hesabı');
    if (args.p_kind === 'clinician' && m.role !== 'owner') return err('Ekibe yalnızca klinik sahibi davet eder');
    let code = makeCode();
    while (db.clinic_invites.some((i: Row) => i.code === code)) code = makeCode();
    const row = { code, clinic_id: m.clinic_id, clinician_id: m.id, kind: args.p_kind ?? 'family', label: String(args.p_label ?? '').slice(0, 60),
      created_at: now(), expires_at: new Date(Date.now() + 15 * 60e3).toISOString(), used_at: null, used_by: null };
    db.clinic_invites.push(row);
    save();
    return { data: { code, expires_at: row.expires_at }, error: null };
  }
  if (name === 'clinic_invite_preview') {
    if (!me?.family_id) return err('Önce ebeveyn olarak giriş yapmalısın');
    const inv = openInvite(args.p_code, 'family');
    if (!inv) return codeErr(anyInvite(args.p_code, 'family'))!;
    const m = db.clinicians.find((x: Row) => x.id === inv.clinician_id);
    return { data: { clinic: db.clinics.find((x: Row) => x.id === inv.clinic_id)?.name, clinician: m?.name ?? '', title: m?.title ?? '' }, error: null };
  }
  if (name === 'redeem_clinic_invite') {
    if (!me?.family_id) return err('Önce ebeveyn olarak giriş yapmalısın');
    if (!myChild(args.p_child_id)) return err('Çocuk bulunamadı');
    const inv = openInvite(args.p_code, 'family');
    if (!inv) return codeErr(anyInvite(args.p_code, 'family'))!;
    if (db.clinic_links.some((l: Row) => l.clinic_id === inv.clinic_id && l.child_id === args.p_child_id && l.status === 'active')) {
      return err('Bu çocuk bu klinikle zaten paylaşılıyor');
    }
    const id = uuid();
    db.clinic_links.push({ id, clinic_id: inv.clinic_id, clinician_id: inv.clinician_id, family_id: me.family_id, child_id: args.p_child_id,
      label: inv.label, status: 'active', consent_by: uid, consent_at: now(), revoked_at: null, created_at: now() });
    inv.used_at = now(); inv.used_by = uid;
    save();
    return { data: { link_id: id }, error: null };
  }
  if (name === 'redeem_clinic_invite_children') {
    if (!me?.family_id) return err('Önce ebeveyn olarak giriş yapmalısın');
    const ids: string[] = [...new Set<string>(args.p_child_ids ?? [])];
    if (!ids.length) return err('En az bir çocuk seç');
    if (ids.some((c) => !myChild(c))) return err('Çocuk bulunamadı');
    const inv = openInvite(args.p_code, 'family');
    if (!inv) return codeErr(anyInvite(args.p_code, 'family'))!;
    const linkIds: string[] = [];
    ids.forEach((child_id) => {
      if (db.clinic_links.some((l: Row) => l.clinic_id === inv.clinic_id && l.child_id === child_id && l.status === 'active')) return;
      const id = uuid();
      linkIds.push(id);
      db.clinic_links.push({ id, clinic_id: inv.clinic_id, clinician_id: inv.clinician_id, family_id: me.family_id, child_id,
        label: inv.label, status: 'active', consent_by: uid, consent_at: now(), revoked_at: null, created_at: now() });
    });
    inv.used_at = now(); inv.used_by = uid;
    save();
    return { data: { link_ids: linkIds, clinic_id: inv.clinic_id }, error: null };
  }
  if (name === 'clinic_share_child') {
    if (!me?.family_id) return err('Önce ebeveyn olarak giriş yapmalısın');
    if (!myChild(args.p_child_id)) return err('Çocuk bulunamadı');
    const base = db.clinic_links.find((l: Row) => l.family_id === me.family_id && l.clinic_id === args.p_clinic_id && l.status === 'active');
    if (!base) return err('Bu uzmanla etkin paylaşım yok; uzmandan yeni kod iste');
    const have = db.clinic_links.find((l: Row) => l.clinic_id === args.p_clinic_id && l.child_id === args.p_child_id && l.status === 'active');
    if (have) return { data: { link_id: have.id }, error: null };
    const id = uuid();
    db.clinic_links.push({ id, clinic_id: args.p_clinic_id, clinician_id: base.clinician_id, family_id: me.family_id, child_id: args.p_child_id,
      label: '', status: 'active', consent_by: uid, consent_at: now(), revoked_at: null, created_at: now() });
    save();
    return { data: { link_id: id }, error: null };
  }
  if (name === 'register_push_token' || name === 'unregister_push_token') return { data: null, error: null };
  if (name === 'mark_notifications_read') {
    let n = 0;
    db.notifications.forEach((r: Row) => {
      if (r.user_id === uid && !r.read_at && (!args.p_ids || args.p_ids.includes(r.id))) { r.read_at = now(); n++; }
    });
    save();
    return { data: n, error: null };
  }
  if (name === 'revoke_clinic_link') {
    const m = myClinician();
    const l = db.clinic_links.find((x: Row) => x.id === args.p_link_id && x.status === 'active'
      && ((me?.family_id && x.family_id === me.family_id) || (m && x.clinic_id === m.clinic_id)));
    if (!l) return err('Paylaşım bulunamadı');
    Object.assign(l, { status: 'revoked', revoked_at: now(), revoked_by: uid });
    save();
    return { data: null, error: null };
  }
  if (name === 'family_clinic_links') {
    const rows = db.clinic_links.filter((l: Row) => l.family_id === me?.family_id && l.status === 'active').map((l: Row) => {
      const m = db.clinicians.find((x: Row) => x.id === l.clinician_id);
      return { link_id: l.id, clinic_id: l.clinic_id, child_id: l.child_id, clinic: db.clinics.find((x: Row) => x.id === l.clinic_id)?.name ?? '', clinician: m?.name ?? '', title: m?.title ?? '', consent_at: l.consent_at,
        history_shared: db.clinic_link_history.some((h: Row) => h.link_id === l.id), history_available: hasHistory(l), verified_as: m?.id === 'demo-clinician' ? 'Klinik psikolog' : null };
    });
    return { data: rows, error: null };
  }
  // Uzman daveti (20261026100000_family_invite_links.sql)
  const famInvite = (key: string) => db.clinic_invites.find((i: Row) => i.kind === 'family'
    && (i.code === String(key ?? '').trim().toUpperCase() || i.token === String(key ?? '').trim().toLowerCase()));
  const rejected = (reason: string) => ({ data: null, error: { message: reason === 'expired' ? 'Davetin süresi doldu (davetler 48 saat geçerli). Uzmanından yeni davet iste.'
    : reason === 'used' ? 'Bu davet başka bir ailede kullanıldı. Uzmanından yeni davet iste.' : 'Davet bulunamadı. Kodu kontrol et ya da uzmanından yeni davet iste.', hint: reason } as any });
  const inviteRow = (i: Row) => {
    const m = db.clinicians.find((x: Row) => x.id === i.clinician_id);
    return { code: i.code, clinic_id: i.clinic_id, clinic: db.clinics.find((x: Row) => x.id === i.clinic_id)?.name ?? '', clinician: m?.name ?? '', title: m?.title ?? '',
      verified_as: null, child_name: i.child_name, child_age_group: i.child_age_group, claimed_at: i.claimed_at,
      has_plan: db.care_modules.some((x: Row) => x.invite_code === i.code) };
  };
  if (name === 'family_pending_invites') {
    return { data: db.clinic_invites.filter((i: Row) => i.kind === 'family' && i.claimed_family === me?.family_id && !i.used_at && !i.revoked_at).map(inviteRow), error: null };
  }
  if (name === 'claim_clinic_invite') {
    if (!me?.family_id) return err('Önce ebeveyn olarak giriş yapmalısın');
    const i = famInvite(args.p_key);
    if (!i) return rejected('not_found');
    if (i.revoked_at) return rejected('expired');
    if (i.claimed_at && i.claimed_family !== me.family_id) return rejected('used');
    if (!i.claimed_at) {
      if (i.used_at) return rejected('used');
      if (i.expires_at <= now()) return rejected('expired');
      Object.assign(i, { claimed_at: now(), claimed_family: me.family_id });
      save();
    }
    return { data: inviteRow(i), error: null };
  }
  if (name === 'family_decline_invite') {
    const i = famInvite(args.p_key);
    if (!i || i.used_at || i.revoked_at) return err('Davet bulunamadı');
    Object.assign(i, { declined_at: now(), revoked_at: now(), child_name: null, child_age_group: null });
    save();
    return { data: null, error: null };
  }
  if (name === 'family_accept_invite') {
    if (!me?.family_id) return err('Önce ebeveyn olarak giriş yapmalısın');
    const i = famInvite(args.p_key);
    if (!i) return rejected('not_found');
    if (i.revoked_at) return rejected('expired');
    if (i.used_at) return rejected('used');
    let ids: string[] = [...(args.p_child_ids ?? [])];
    const c = args.p_child;
    if (c) {
      const nm = String(c.name ?? '').trim();
      if (!nm || nm.length > 40) return err('Çocuğun adını yaz (en çok 40 harf)');
      const dup = db.children.find((x: Row) => x.family_id === me.family_id && x.name.trim().toLowerCase() === nm.toLowerCase() && !ids.includes(x.id));
      if (dup && !c.allow_duplicate) {
        return { data: { error: 'duplicate_child', child_id: dup.id, name: dup.name, message: 'Kayıtlarında bu isimde bir çocuk var. Aynı çocuksa onu seç; değilse yine de ekleyebilirsin.' }, error: null };
      }
      const id = uuid();
      db.children.push({ id, family_id: me.family_id, name: nm, avatar: c.avatar || 'kedi', gender: c.gender ?? null, birthday: c.birthday ?? null,
        age_band: ['K', 'A'].includes(c.age_group) ? 'A' : ['B', 'C'].includes(c.age_group) ? 'B' : null, user_id: null, created_at: now() });
      ids = [...ids, id];
    }
    if (!ids.length) return err('En az bir çocuk seç');
    const linkIds: string[] = [];
    ids.forEach((child_id) => {
      const id = uuid();
      linkIds.push(id);
      db.clinic_links.push({ id, clinic_id: i.clinic_id, clinician_id: i.clinician_id, family_id: me.family_id, child_id, label: '', status: 'active',
        consent_by: uid, consent_at: now(), revoked_at: null, created_at: now(), consent_version: args.p_consent_version });
      if (args.p_share_history) db.clinic_link_history.push({ link_id: id, consent_version: args.p_history_version });
    });
    Object.assign(i, { used_at: now(), used_by: uid, child_name: null, child_age_group: null });
    save();
    return { data: { link_ids: linkIds, child_ids: ids, clinic_id: i.clinic_id }, error: null };
  }
  if (name === 'clinic_link_history_set') {
    const l = db.clinic_links.find((x: Row) => x.id === args.p_link_id && x.family_id === me?.family_id);
    if (!l) return err('Paylaşım bulunamadı');
    db.clinic_link_history = db.clinic_link_history.filter((h: Row) => h.link_id !== l.id);
    if (args.p_on) db.clinic_link_history.push({ link_id: l.id, consent_version: args.p_consent_version });
    save();
    return { data: 1, error: null };
  }
  if (name === 'family_care_plan') {
    const l = db.clinic_links.find((x: Row) => x.id === args.p_link_id && x.family_id === me?.family_id && x.status === 'active');
    if (!l) return { data: null, error: null };
    const week = day(-6);
    return { data: {
      goals: db.clinic_goals.filter((g: Row) => g.link_id === l.id && g.shared && !g.archived)
        .map((g: Row) => ({ id: g.id, title: g.title, description: g.description, target: g.target ?? '', home_support: g.home_support ?? '', status: g.status ?? 'active' })),
      modules: db.care_modules.filter((m: Row) => m.link_id === l.id && m.status !== 'planned').map((m: Row) => ({ ...m,
        practiced_week: db.care_module_logs.filter((x: Row) => x.module_id === m.id && x.practiced && x.day >= week).length })),
    }, error: null };
  }
  if (name === 'family_premium') {
    const fid = args.p_family_id ?? me?.family_id;
    const own = db.family_subscriptions.some((s: Row) => s.family_id === fid && s.plan === 'premium');
    return { data: own || db.clinic_links.some((l: Row) => l.family_id === fid && l.status === 'active' && clinicActive(l.clinic_id)), error: null };
  }
  // Abonelik (20261021140000_subscriptions.sql)
  const fam = db.families.find((f: Row) => f.id === me?.family_id);
  const cfg = { enforce: false, trial_days: 7, free_max_tasks: 3, free_max_children: 1, ...(db.billing ?? {}) };
  const access = () => {
    const sub = db.family_subscriptions.find((x: Row) => x.family_id === fam?.id);
    const premium = sub?.plan === 'premium' && (!sub.period_end || sub.period_end > now());
    const end = fam?.trial_started_at ? new Date(new Date(fam.trial_started_at).getTime() + cfg.trial_days * 864e5) : null;
    const state = premium ? 'premium' : !end ? 'pending' : end.getTime() > Date.now() ? 'trial' : 'expired';
    return {
      state, enforced: cfg.enforce, full: state !== 'expired' || !cfg.enforce, trial_ends_at: end?.toISOString() ?? null,
      days_left: state === 'trial' ? Math.ceil((end!.getTime() - Date.now()) / 864e5) : null,
      plan: premium ? sub.billing : null, period_end: premium ? sub.period_end : null, auto_renew: premium ? sub.auto_renew : null,
      limits: { max_tasks: cfg.free_max_tasks, max_children: cfg.free_max_children },
    };
  };
  const premiumErr = (what: string) => ({ data: null, error: { message: `Bu özellik Premium üyelikte: ${what}`, hint: 'premium_required', code: 'P0001' } });
  if (name === 'family_access') return { data: access(), error: null };

  // Mesajlar (20261021150000_messages.sql)
  if (name === 'mark_messages_read') {
    let n = 0;
    db.messages.forEach((m: Row) => { if (m.child_id === args.p_child_id && m.family_id === me?.family_id && m.sender === 'child' && !m.read_at) { m.read_at = now(); n++; } });
    save();
    return { data: n, error: null };
  }

  // Güneş Taşı ve ödüller (20261021160000_sun_stones_rewards.sql)
  const stones = (cid: string) => db.sun_stone_ledger.filter((l: Row) => l.child_id === cid).reduce((a: number, l: Row) => a + l.amount, 0);
  const spend = (cid: string, amount: number, reason: string, note: string | null) => {
    const bal = stones(cid);
    if (bal < amount) return { data: null, error: { message: `Yeterli Güneş Taşı yok (bakiye ${bal}, gereken ${amount})`, hint: 'not_enough_stones' } };
    db.sun_stone_ledger.push({ id: db.sun_stone_ledger.length + 1, family_id: me.family_id, child_id: cid, amount: -amount, reason, ref: uuid(), note, created_by: uid, created_at: now() });
    return null;
  };
  if (name === 'sun_stones_spendable') {
    if (!myChild(args.p_child_id)) return err('Yetki yok');
    return { data: stones(args.p_child_id), error: null };
  }
  if (name === 'give_reward') {
    if (!myChild(args.p_child_id)) return err('Çocuk bulunamadı');
    if (!access().full) return premiumErr('ödül verme');
    const r = db.rewards.find((x: Row) => x.id === args.p_reward_id && x.family_id === me.family_id && x.active);
    if (!r || ((r.child_ids ?? []).length && !r.child_ids.includes(args.p_child_id))) return err('Ödül bulunamadı');
    const q = args.p_quantity ?? 1;
    const label = r.unit ? `${r.title} · ${r.unit_amount * q} ${r.unit === 'minute' ? 'dakika' : 'TL'}` : r.title;
    const bad = spend(args.p_child_id, r.cost * q, 'reward', label);
    if (bad) return bad;
    db.reward_requests.push({ id: uuid(), family_id: me.family_id, child_id: args.p_child_id, reward_id: r.id, title: r.title, quantity: q, cost: r.cost * q, unit: r.unit, amount: r.unit ? r.unit_amount * q : null, source: 'parent', status: 'approved', created_at: now(), decided_at: now() });
    save();
    return { data: { balance: stones(args.p_child_id) }, error: null };
  }
  if (name === 'deduct_sun_stones') {
    if (!myChild(args.p_child_id)) return err('Çocuk bulunamadı');
    if (!(args.p_amount >= 1 && args.p_amount <= 100)) return err('Düşülecek taş 1–100 arası olmalı');
    if (!access().full) return premiumErr('Güneş Taşı düşme');
    const bad = spend(args.p_child_id, args.p_amount, 'penalty', args.p_note ?? null);
    if (bad) return bad;
    save();
    return { data: { balance: stones(args.p_child_id) }, error: null };
  }
  if (name === 'decide_reward_request') {
    const q = db.reward_requests.find((x: Row) => x.id === args.p_request_id && x.family_id === me?.family_id);
    if (!q) return err('İstek bulunamadı');
    if (q.status !== 'pending') return err('Bu isteğe zaten karar verildi');
    if (args.p_approve) {
      const bad = spend(q.child_id, q.cost, 'reward', q.title);
      if (bad) return bad;
    }
    Object.assign(q, { status: args.p_approve ? 'approved' : 'rejected', note: args.p_note ?? null, decided_at: now(), decided_by: uid });
    save();
    return { data: { status: q.status }, error: null };
  }
  return { data: null, error: null };
}

/* ---------- Dosyalar (Posta fotoğraf/ses) ---------- */

function toDataUrl(body: ArrayBuffer, type: string) {
  const bytes = new Uint8Array(body);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}

const storage = {
  from: () => ({
    async upload(path: string, body: ArrayBuffer, opts?: { contentType?: string }) {
      db.blobs[path] = toDataUrl(body, opts?.contentType ?? 'application/octet-stream');
      save();
      return { data: { path }, error: null };
    },
    async createSignedUrl(path: string) {
      return { data: { signedUrl: db.blobs[path] ?? '' }, error: null };
    },
    async createSignedUrls(paths: string[]) {
      return { data: paths.map((path) => ({ path, signedUrl: db.blobs[path] ?? '' })), error: null };
    },
    async list(prefix: string) {
      // Supabase gibi: doğrudan dosyalar (id'li) + alt klasörler (id'siz)
      const rest = Object.keys(db.blobs).filter((k) => k.startsWith(`${prefix}/`)).map((k) => k.slice(prefix.length + 1));
      const files = rest.filter((r) => !r.includes('/')).map((name) => ({ name, id: name }));
      const dirs = [...new Set(rest.filter((r) => r.includes('/')).map((r) => r.split('/')[0]))].map((name) => ({ name, id: null }));
      return { data: [...files, ...dirs], error: null };
    },
    async remove(paths: string[]) {
      paths.forEach((p) => delete db.blobs[p]);
      save();
      return { data: paths.map((name) => ({ name })), error: null };
    },
  }),
};

/* ---------- Dışa açılan istemci ---------- */

const channel = () => {
  const c: any = { on: () => c, subscribe: () => c };
  return c;
};

export const isSupabaseConfigured = true;
export const MAIL_BUCKET = 'mail';
// Uygulama kodu gerçek istemcinin tipleriyle derlensin diye SupabaseClient olarak sunulur
export const supabase = {
  auth,
  from: (t: string) => new Query(t),
  rpc,
  storage,
  channel,
  removeChannel() {},
} as unknown as SupabaseClient;

// Önizlemeyi baştan başlatmak için (tarayıcı konsolunda): parentappSifirla()
(globalThis as any).onizlemeSifirla = (globalThis as any).parentappSifirla = () => {
  try { localStorage.removeItem(KEY); } catch { /* yok say */ }
  db = seed();
  location.reload();
};
