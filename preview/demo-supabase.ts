// ÖNİZLEME İÇİN DENEME VERİTABANI
// Web önizlemesi derlenirken src/lib/supabase.ts yerine bu dosya kullanılır
// (bkz. preview/build.sh). Supabase istemcisinin uygulamada kullanılan kısmını
// taklit eder; veriler tarayıcıda (localStorage) saklanır. Uygulamanın
// gerçek sürümünde kullanılmaz.

import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>;
type Err = { message: string; code?: string } | null;
type Db = { users: Row[]; blobs: Record<string, string>; session: Row | null } & Record<string, any>;

const KEY = 'fidan-onizleme-v1';
const TABLES = ['profiles', 'families', 'children', 'tasks', 'task_assignments', 'completions', 'messages', 'saved_templates', 'invite_codes'];

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
  const db: Db = { users: [], blobs: {}, session: null };
  TABLES.forEach((t) => { db[t] = []; });
  db.users.push({ id: U, email: 'demo@fidan.app', password: '12345678' });
  db.families.push({ id: F, name: 'Ailem', created_at: now() });
  db.profiles.push({ id: U, family_id: F, nickname: 'Anne', name: 'Ayşe', avatar: 'kadın', created_at: now() });
  db.children.push(
    { id: 'c-nazli', family_id: F, name: 'Nazlı', avatar: 'flamingo', gender: 'kız', birthday: '2018-04-12', user_id: null, created_at: ago(9000) },
    { id: 'c-arven', family_id: F, name: 'Arven', avatar: 'keçi', gender: 'erkek', birthday: '2020-09-03', user_id: null, created_at: ago(8000) },
  );
  const task = (id: string, title: string, emoji: string, skill: string, start: number, recurring: boolean, reminder: string | null, review: boolean, kids: [string, string, number][]) => {
    db.tasks.push({ id, family_id: F, title, emoji, skill, description: '', start_date: day(start), recurring, end_date: null, reminder, requires_review: review, created_at: ago(5000 - db.tasks.length) });
    kids.forEach(([child_id, difficulty, coins]) => db.task_assignments.push({ task_id: id, child_id, family_id: F, difficulty, coins }));
  };
  task('k-yatak', 'Yatağını topla', '🛏️', 'Takım Çalışması', -14, true, '08:00', true, [['c-nazli', 'easy', 5], ['c-arven', 'easy', 5]]);
  task('k-kitap', '10 dakika kitap oku', '📖', 'Odaklanma', -10, true, null, true, [['c-nazli', 'medium', 10]]);
  task('k-dis', 'Dişlerini fırçala', '🪥', 'Öz Bakım', -20, true, '21:00', false, [['c-nazli', 'easy', 5], ['c-arven', 'easy', 5]]);
  task('k-cicek', 'Çiçekleri sula', '🪴', 'Sorumluluk', 0, false, null, true, [['c-arven', 'easy', 5]]);
  const done = (task_id: string, child_id: string, d: number, status = 'approved') =>
    db.completions.push({ id: uuid(), family_id: F, task_id, child_id, date: day(d), status, created_at: now() });
  done('k-dis', 'c-nazli', 0);
  done('k-yatak', 'c-nazli', 0, 'pending');
  done('k-kitap', 'c-nazli', -1, 'pending');
  for (let n = 1; n <= 12; n++) {
    done('k-dis', 'c-nazli', -n);
    if (n % 2) done('k-yatak', 'c-nazli', -n);
    if (n % 3) done('k-dis', 'c-arven', -n);
    if (n % 4 === 0) done('k-kitap', 'c-nazli', -n);
  }
  const msg = (child_id: string, sender: string, body: string, min: number) =>
    db.messages.push({ id: uuid(), family_id: F, child_id, sender, sender_id: sender === 'parent' ? U : null, kind: 'text', body, media_path: null, duration_ms: null, created_at: ago(min) });
  msg('c-nazli', 'parent', 'Bugün kitabını okudun mu? 📖', 180);
  msg('c-nazli', 'child', 'Evet anne, 2 bölüm okudum!', 150);
  msg('c-nazli', 'parent', 'Harikasın! Akşam birlikte devam edelim 🌱', 140);
  db.saved_templates.push({ id: uuid(), family_id: F, template_key: 't1', is_custom: false, saved: true, created_at: now() });
  db.session = { user: { id: U, email: 'demo@fidan.app' }, access_token: 'demo' };
  return db;
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* depolama kapalıysa her açılışta örnek aile */ }
  return seed();
}

let db = load();
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* sığmazsa (ör. büyük fotoğraflar) yalnızca bu oturumda kalır */ }
};

/* ---------- Tablo sorguları ---------- */

const PK: Record<string, string[]> = {
  task_assignments: ['task_id', 'child_id'],
  completions: ['task_id', 'child_id', 'date'],
  invite_codes: ['code'],
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
const emit = (event: string) => listeners.forEach((l) => l(event, db.session));
const fail = (message: string, code?: string) => ({ data: { session: null, user: null }, error: { message, code } });
const myProfile = () => db.profiles.find((p: Row) => p.id === db.session?.user.id);

function newFamilyFor(userId: string, name: string) {
  const fid = uuid();
  db.families.push({ id: fid, name: 'Ailem', created_at: now() });
  db.profiles.push({ id: userId, family_id: fid, nickname: 'Ben', name, avatar: 'erkek', created_at: now() });
}

const auth = {
  async getSession() { return { data: { session: db.session }, error: null }; },
  onAuthStateChange(cb: Listener) {
    listeners.push(cb);
    return { data: { subscription: { unsubscribe() { listeners.splice(listeners.indexOf(cb), 1); } } } };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) return fail('Invalid login credentials', 'invalid_credentials');
    db.session = { user: { id: u.id, email: u.email }, access_token: 'demo' };
    save(); emit('SIGNED_IN');
    return { data: { session: db.session }, error: null };
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Row } }) {
    if (db.users.some((x) => x.email.toLowerCase() === email.toLowerCase())) return fail('User already registered', 'user_already_exists');
    const id = uuid();
    db.users.push({ id, email, password });
    newFamilyFor(id, options?.data?.name ?? '');
    db.session = { user: { id, email }, access_token: 'demo' };
    save(); emit('SIGNED_IN');
    return { data: { session: db.session, user: db.session.user }, error: null };
  },
  async signOut() { db.session = null; save(); emit('SIGNED_OUT'); return { error: null }; },
  async updateUser({ password }: { password?: string }) {
    const u = db.users.find((x) => x.id === db.session?.user.id);
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
  const me = myProfile();
  const uid = db.session?.user.id;
  if (!uid) return { data: null, error: { message: 'Önce giriş yapmalısın' } };
  if (name === 'create_invite_code') {
    if (!me?.family_id) return { data: null, error: { message: 'Önce giriş yapmalısın' } };
    if (args.p_kind === 'child') db.invite_codes = db.invite_codes.filter((i: Row) => !(i.child_id === args.p_child_id && !i.used_at));
    const row = {
      code: makeCode(), family_id: me.family_id, kind: args.p_kind ?? 'parent', child_id: args.p_child_id ?? null,
      created_by: uid, created_at: now(), expires_at: new Date(Date.now() + 864e5).toISOString(), used_at: null,
    };
    db.invite_codes.push(row);
    save();
    return { data: [{ code: row.code, expires_at: row.expires_at }], error: null };
  }
  if (name === 'join_family') {
    const inv = db.invite_codes.find((i: Row) => i.code === String(args.p_code).trim().toUpperCase() && i.kind === 'parent');
    if (!inv || inv.used_at || inv.expires_at < now()) return { data: null, error: { message: 'Kod geçersiz ya da süresi dolmuş' } };
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
    return { data: inv.family_id, error: null };
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
    async createSignedUrls(paths: string[]) {
      return { data: paths.map((path) => ({ path, signedUrl: db.blobs[path] ?? '' })), error: null };
    },
    async list(prefix: string) {
      return { data: Object.keys(db.blobs).filter((k) => k.startsWith(`${prefix}/`)).map((k) => ({ name: k.slice(prefix.length + 1) })), error: null };
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

// Önizlemeyi baştan başlatmak için (tarayıcı konsolunda): fidanSifirla()
(globalThis as any).fidanSifirla = () => {
  try { localStorage.removeItem(KEY); } catch { /* yok say */ }
  db = seed();
  location.reload();
};
