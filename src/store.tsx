import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { Difficulty, difficultyMeta } from './theme';
import { Template, Category, templates as baseTemplates, toCategory, categorySkill, skillLabels } from './data/templates';
import { fromISO, toISO, todayISO } from './dates';
import { supabase, MAIL_BUCKET } from './lib/supabase';
import { uuid } from './lib/uuid';
import { track } from './lib/track';
import { readFileBytes } from './lib/files';
import { TaskDayPart } from './data/dayParts';
import { AgeBand, toAgeBand } from './data/ageBands';
import { childAvatarId } from './data/avatars';
import { toAppError } from './lib/errors';
import { requestPremium } from './lib/billing';

export type Child = {
  id: string;
  name: string;
  avatar: string;
  gender?: 'kız' | 'erkek';
  birthday?: string; // ISO
  ageBand?: AgeBand; // ebeveynin bilerek seçtiği oyun yaş grubu (K/A/B/C); yoksa otomatik (doğum gününden)
  linked: boolean; // çocuk oyuna giriş kodunu kullandı (cihaz bağlı)
};

export type Parent = { id: string; nickname: string; name: string; avatar: string };

export type Assignment = { childId: string; difficulty: Difficulty; coins: number };

export type Task = {
  id: string;
  title: string;
  emoji: string;
  skill: string;
  description: string;
  assignments: Assignment[];
  startDate: string;
  recurring: boolean;
  repeatKind: RepeatKind; // recurring ise: her gün / haftanın günleri / ayın günleri
  repeatDays: number[]; // weekly: 1 = Pzt … 7 = Paz, monthly: 1 … 31
  endDate?: string;
  reminder?: string; // HH:MM
  dayPart?: TaskDayPart; // Sabah / Öğlen / Akşam; yoksa herhangi bir saat
  requiresReview: boolean;
  sortOrder: number; // Görevler ekranındaki sıra (küçük olan üstte)
};

export type RepeatKind = 'daily' | 'weekly' | 'monthly';

// Ebeveynin kendi şablonu: beceri kategoriden gelir
export type CustomTemplateInput = { title: string; emoji: string; category: Category; difficulty: Difficulty };

// pending: çocuk "yaptım" dedi · approved: onaylandı (coin verilir)
// declined: çocuk "yapamam" dedi · rejected: ebeveyn notla reddetti · retry: ebeveyn "tekrar dene" dedi (çocuk yeniden yapar)
export type CompletionStatus = 'pending' | 'approved' | 'declined' | 'rejected' | 'retry';
export type ReviewDecision = 'approved' | 'rejected' | 'retry';
// İnceleme ayrıntısı (ortak/sozlesme/akislar.md 3, 9c): motivasyon 1–5 (uzmana akar), taş 0–6 (boş = zorluğa göre), not oyunda görünür
export type ReviewExtra = { note?: string; motivation?: number | null; stones?: number | null };
// anahtar: `${taskId}|${childId}|${date}`
export type Completions = Record<string, CompletionStatus>;

export type MessageKind = 'text' | 'image' | 'audio' | 'sticker';
export type Message = {
  id: string;
  childId: string;
  text: string;
  at: string;
  sender: 'parent' | 'child';
  kind: MessageKind;
  mediaPath?: string; // Storage yolu
  mediaUrl?: string; // gösterim için (imzalı URL ya da gönderilirken yerel dosya)
  durationMs?: number; // sesli mesaj
  readAt?: string; // karşı taraf okudu
};

export type InviteCode = { code: string; createdAt: string; expiresAt?: string };
// Kodlar sunucuda üretilir: tek kullanımlık, 15 dakika geçerli
export type IssuedCode = { code: string; expiresAt: string };

type Store = {
  ready: boolean;
  familyId: string | null;
  parent: Parent;
  children: Child[];
  tasks: Task[];
  completions: Completions;
  messages: Message[];
  savedIds: string[];
  customTemplates: Template[];
  inviteCodes: InviteCode[];
  addChild: (c: Omit<Child, 'id' | 'linked'>) => Promise<string | null>; // sunucuya yazılınca çocuğun kimliği
  renameChild: (id: string, name: string) => void;
  setChildAvatar: (id: string, avatar: string) => void; // hazır simge ya da 'photo:<yol>'
  setChildAgeBand: (childId: string, band: AgeBand | null) => void;
  childBalance: (childId: string) => Promise<number>;
  unlinkChildDevice: (childId: string) => Promise<void>;
  updateParent: (p: Partial<Parent>) => void;
  addTasks: (t: Omit<Task, 'id' | 'sortOrder'>[], onSaved?: (ids: string[]) => void) => void;
  reorderTasks: (orderedIds: string[]) => void; // verilen görevleri bu sırayla diz
  updateTask: (id: string, patch: Partial<Task>) => void; // tekrarlayan görevde tek kayıt => tüm günlere yansır
  deleteTask: (id: string) => void;
  toggleCompletion: (task: Task, childId: string, date: string) => void;
  review: (key: string, decision: ReviewDecision, extra?: ReviewExtra) => Promise<boolean>; // not çocuğa oyunda görünür
  toggleSaved: (templateId: string) => void;
  addCustomTemplate: (t: CustomTemplateInput) => string;
  allTemplates: Template[];
  sendMessage: (childId: string, text: string) => void;
  sendSticker: (childId: string, key: string) => void;
  markThreadRead: (childId: string) => void;
  sendPhoto: (childId: string, localUri: string, mimeType?: string) => Promise<void>;
  sendVoice: (childId: string, localUri: string, durationMs: number) => Promise<void>;
  createInviteCode: () => Promise<IssuedCode>;
  createChildCode: (childId: string) => Promise<IssuedCode>;
  joinFamily: (code: string) => Promise<void>;
  refresh: () => Promise<void>;
  isOnlyParent: () => Promise<boolean>;
  deleteAccount: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export const completionKey = (taskId: string, childId: string, date: string) =>
  `${taskId}|${childId}|${date}`;

export const taskOccursOn = (task: Task, date: string) => {
  if (date < task.startDate) return false;
  if (!task.recurring) return date === task.startDate;
  if (task.endDate && date > task.endDate) return false;
  const d = fromISO(date);
  if (task.repeatKind === 'weekly') {
    const dow = ((d.getDay() + 6) % 7) + 1; // 1 = Pzt … 7 = Paz
    const days = task.repeatDays.length ? task.repeatDays : [((fromISO(task.startDate).getDay() + 6) % 7) + 1];
    return days.includes(dow);
  }
  if (task.repeatKind === 'monthly') {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const days = task.repeatDays.length ? task.repeatDays : [fromISO(task.startDate).getDate()];
    // Ayda olmayan günler (ör. 31) ayın son gününe düşer
    return days.some((x) => Math.min(x, last) === d.getDate());
  }
  return true;
};

/* ---------- Veritabanı satırı <-> uygulama nesnesi ---------- */

type Row = Record<string, any>;

const toChild = (r: Row): Child => ({
  id: r.id,
  name: r.name,
  avatar: childAvatarId(r.avatar, r.gender), // eski hayvan kimliği → Okti çocuğu (cinsiyete göre; veri değişmez)
  gender: r.gender ?? undefined,
  birthday: r.birthday ?? undefined,
  ageBand: toAgeBand(r.age_band),
  linked: !!r.user_id,
});

const toTask = (r: Row): Task => ({
  id: r.id,
  title: r.title,
  emoji: r.emoji,
  skill: r.skill,
  description: r.description,
  assignments: (r.task_assignments ?? []).map((a: Row) => ({
    childId: a.child_id, difficulty: a.difficulty, coins: a.coins,
  })),
  startDate: r.start_date,
  recurring: r.recurring,
  repeatKind: r.repeat_kind ?? 'daily',
  repeatDays: r.repeat_days ?? [],
  endDate: r.end_date ?? undefined,
  reminder: r.reminder ?? undefined,
  dayPart: r.day_part ?? undefined,
  requiresReview: r.requires_review,
  sortOrder: r.sort_order ?? new Date(r.created_at).getTime() / 1000,
});

const bySortOrder = (a: Task, b: Task) => a.sortOrder - b.sortOrder;

const taskRow = (t: Partial<Task>) => {
  const r: Row = {};
  if (t.title !== undefined) r.title = t.title;
  if (t.emoji !== undefined) r.emoji = t.emoji;
  if (t.skill !== undefined) r.skill = t.skill;
  if (t.description !== undefined) r.description = t.description;
  if (t.startDate !== undefined) r.start_date = t.startDate;
  if (t.recurring !== undefined) r.recurring = t.recurring;
  if (t.repeatKind !== undefined) r.repeat_kind = t.repeatKind;
  if (t.repeatDays !== undefined) r.repeat_days = t.repeatDays;
  if (t.sortOrder !== undefined) r.sort_order = t.sortOrder;
  if ('endDate' in t) r.end_date = t.endDate ?? null;
  if ('reminder' in t) r.reminder = t.reminder ?? null;
  if ('dayPart' in t) r.day_part = t.dayPart ?? null;
  if (t.requiresReview !== undefined) r.requires_review = t.requiresReview;
  return r;
};

const assignmentRows = (familyId: string, taskId: string, list: Assignment[]) =>
  list.map((a) => ({ task_id: taskId, child_id: a.childId, family_id: familyId, difficulty: a.difficulty, coins: a.coins }));

const toMessage = (r: Row): Message => ({
  id: r.id,
  childId: r.child_id,
  text: r.body ?? '',
  at: r.created_at,
  sender: r.sender,
  kind: r.kind,
  mediaPath: r.media_path ?? undefined,
  durationMs: r.duration_ms ?? undefined,
  readAt: r.read_at ?? undefined,
});

const SIGNED_URL_SECONDS = 60 * 60 * 24; // gizli kovadaki dosyalar için geçici bağlantı

// Medya mesajlarına görüntüleme bağlantısı ekle
async function withMediaUrls(list: Message[]): Promise<Message[]> {
  const paths = list.filter((m) => m.mediaPath && !m.mediaUrl).map((m) => m.mediaPath!);
  if (!paths.length) return list;
  const { data } = await supabase.storage.from(MAIL_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  const urls: Record<string, string> = {};
  (data ?? []).forEach((d) => { if (d.path && d.signedUrl) urls[d.path] = d.signedUrl; });
  return list.map((m) => (m.mediaPath && urls[m.mediaPath] ? { ...m, mediaUrl: urls[m.mediaPath] } : m));
}

const extFor = (mime: string) =>
  ({ 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp', 'audio/mp4': 'm4a' } as Record<string, string>)[mime] ?? 'jpg';

const emptyParent: Parent = { id: '', nickname: 'Ben', name: '', avatar: 'erkek' };

/* ---------- Sağlayıcı ---------- */

export function StoreProvider({ userId, children: kids }: { userId: string | null; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [parent, setParent] = useState<Parent>(emptyParent);
  const [children, setChildren] = useState<Child[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completions>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedRows, setSavedRows] = useState<Row[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);

  const fid = useRef<string | null>(null);
  const completionsRef = useRef<Completions>({});
  completionsRef.current = completions;
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const sendingIds = useRef(new Set<string>()); // yüklenmekte olan medya mesajları

  /* --- okuma --- */

  const loadChildren = useCallback(async (f: string) => {
    const { data, error } = await supabase.from('children').select('*').eq('family_id', f).order('created_at');
    if (!error && data) setChildren(data.map(toChild));
  }, []);

  const loadTasks = useCallback(async (f: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_assignments(child_id, difficulty, coins)')
      .eq('family_id', f)
      .order('created_at');
    if (!error && data) setTasks(data.map(toTask).sort(bySortOrder));
  }, []);

  const loadCompletions = useCallback(async (f: string) => {
    const { data, error } = await supabase.from('completions').select('task_id, child_id, date, status').eq('family_id', f);
    if (!error && data) {
      const c: Completions = {};
      data.forEach((r) => { c[completionKey(r.task_id, r.child_id, r.date)] = r.status; });
      setCompletions(c);
    }
  }, []);

  const loadMessages = useCallback(async (f: string) => {
    const { data, error } = await supabase.from('messages').select('*').eq('family_id', f).order('created_at');
    if (!error && data) {
      const loaded = await withMediaUrls(data.map(toMessage));
      setMessages((prev) => [
        ...loaded,
        ...prev.filter((m) => sendingIds.current.has(m.id) && !loaded.some((x) => x.id === m.id)),
      ]);
    }
  }, []);

  const loadSaved = useCallback(async (f: string) => {
    const { data, error } = await supabase.from('saved_templates').select('*').eq('family_id', f).order('created_at');
    if (!error && data) setSavedRows(data);
  }, []);

  const loadCodes = useCallback(async (f: string) => {
    const { data, error } = await supabase
      .from('invite_codes').select('code, created_at, expires_at').eq('family_id', f).eq('kind', 'parent').order('created_at');
    if (!error && data) setInviteCodes(data.map((r) => ({ code: r.code, createdAt: r.created_at, expiresAt: r.expires_at })));
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    let { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!profile) {
      // Kayıttan hemen sonra profil tetikleyicisi bir an gecikebilir.
      await new Promise((r) => setTimeout(r, 800));
      ({ data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
    }
    if (!profile) { setReady(true); return; }
    setParent({ id: profile.id, nickname: profile.nickname, name: profile.name, avatar: profile.avatar });
    const f: string | null = profile.family_id;
    fid.current = f;
    setFamilyId(f);
    if (f) {
      await Promise.all([loadChildren(f), loadTasks(f), loadCompletions(f), loadMessages(f), loadSaved(f), loadCodes(f)]);
    }
    setReady(true);
  }, [userId, loadChildren, loadTasks, loadCompletions, loadMessages, loadSaved, loadCodes]);

  // Oturum değişince sıfırla ve yeniden yükle
  useEffect(() => {
    setReady(false);
    setFamilyId(null); fid.current = null;
    setParent(emptyParent); setChildren([]); setTasks([]); setCompletions({});
    setMessages([]); setSavedRows([]); setInviteCodes([]);
    if (userId) refresh();
  }, [userId, refresh]);

  // Realtime: diğer ebeveynin ve çocuk uygulamasının değişiklikleri anında gelir
  useEffect(() => {
    if (!familyId) return;
    const f = familyId;
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    const later = (name: string, fn: () => void) => {
      clearTimeout(timers[name]);
      timers[name] = setTimeout(fn, 250);
    };
    const filter = `family_id=eq.${f}`;
    const channel = supabase
      .channel(`family:${f}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, async (p) => {
        const raw = toMessage(p.new as Row);
        // Kendi gönderdiğimiz mesaj zaten ekranda (yerel dosyayla); bağlantı imzalamaya gerek yok
        if (messagesRef.current.some((x) => x.id === raw.id)) return;
        const [m] = await withMediaUrls([raw]);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, (p) => {
        const r = p.new as Row;
        setMessages((prev) => prev.map((x) => (x.id === r.id ? { ...x, readAt: r.read_at ?? undefined } : x)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) => {
        const id = (p.old as Row).id;
        setMessages((prev) => prev.filter((x) => x.id !== id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completions', filter }, () => later('c', () => loadCompletions(f)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'completions' }, () => later('c', () => loadCompletions(f)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter }, () => later('t', () => loadTasks(f)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments', filter }, () => later('t', () => loadTasks(f)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children', filter }, () => later('k', () => loadChildren(f)))
      .subscribe();
    return () => {
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [familyId, loadCompletions, loadTasks, loadChildren]);

  // Ön plana dönünce eşitle (arka plandayken kaçan Realtime olayları, süresi dolan medya bağlantıları)
  useEffect(() => {
    if (!familyId) return;
    const f = familyId;
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', (state) => {
      // Yalnızca gerçekten arka plandan dönünce (galeri/izin pencereleri 'inactive' yapar, onları sayma)
      if (state === 'active' && prev === 'background') {
        loadMessages(f); loadCompletions(f); loadTasks(f); loadChildren(f);
      }
      prev = state;
    });
    return () => sub.remove();
  }, [familyId, loadMessages, loadCompletions, loadTasks, loadChildren]);

  /* --- yazma --- */

  // Sunucu hatasında kullanıcıyı uyar ve ekranı sunucudaki gerçek veriyle eşitle.
  const run = useCallback(
    async (op: () => PromiseLike<{ error: { message: string; hint?: string | null } | null }>) => {
      const { error } = await op();
      if (error) {
        // Ücretsiz plan sınırı: üyelik ekranı (ortak/sozlesme/durumlar.md 12)
        if (error.hint === 'premium_required') requestPremium(error.message);
        else Alert.alert('Kaydedilemedi', error.message);
        refresh();
      }
    },
    [refresh],
  );

  const addChild = useCallback(async (c: Omit<Child, 'id' | 'linked'>): Promise<string | null> => {
    track('child.add');
    const f = fid.current;
    if (!f) return null;
    const child: Child = { ...c, id: uuid(), linked: false };
    setChildren((p) => [...p, child]);
    let ok = false;
    await run(async () => {
      const ins = await supabase.from('children').insert({
        id: child.id, family_id: f, name: c.name, avatar: c.avatar, gender: c.gender ?? null, birthday: c.birthday ?? null,
      });
      ok = !ins.error;
      if (ins.error || !c.ageBand) return ins;
      return supabase.rpc('set_child_age_band', { p_child_id: child.id, p_band: c.ageBand });
    });
    return ok ? child.id : null;
  }, [run]);

  const renameChild = useCallback((id: string, name: string) => {
    const nm = name.trim();
    if (!nm) return;
    setChildren((p) => p.map((c) => (c.id === id ? { ...c, name: nm } : c)));
    run(() => supabase.from('children').update({ name: nm }).eq('id', id));
  }, [run]);

  const setChildAvatar = useCallback((id: string, avatar: string) => {
    setChildren((p) => p.map((c) => (c.id === id ? { ...c, avatar } : c)));
    run(() => supabase.from('children').update({ avatar }).eq('id', id));
  }, [run]);

  // null: otomatik (doğum gününden; durumlar.md §4)
  const setChildAgeBand = useCallback((childId: string, band: AgeBand | null) => {
    setChildren((p) => p.map((c) => (c.id === childId ? { ...c, ageBand: band ?? undefined } : c)));
    run(() => supabase.rpc('set_child_age_band', { p_child_id: childId, p_band: band }));
  }, [run]);

  // Coin bakiyesi sunucuda (coin_ledger): yalnızca onaylanan görevlerle artar, oyunda harcanınca düşer.
  const childBalance = useCallback(async (childId: string) => {
    const { data, error } = await supabase.rpc('child_balance', { p_child_id: childId });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  }, []);

  // Oyundaki cihaz bağlantısını kaldır: oyun "bağlantın kapatıldı" der, yeni giriş kodu gerekir.
  const unlinkChildDevice = useCallback(async (childId: string) => {
    const { error } = await supabase.rpc('unlink_child_device', { p_child_id: childId });
    if (error) throw new Error(error.message);
    setChildren((p) => p.map((c) => (c.id === childId ? { ...c, linked: false } : c)));
  }, []);

  // Profil alanları her tuşta değişir; sunucuya kısa bir beklemeyle tek seferde yazılır.
  const parentPatch = useRef<Row>({});
  const parentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const updateParent = useCallback((p: Partial<Parent>) => {
    setParent((x) => ({ ...x, ...p }));
    if (!userId) return;
    const { nickname, name, avatar } = p;
    Object.assign(parentPatch.current, JSON.parse(JSON.stringify({ nickname, name, avatar })));
    clearTimeout(parentTimer.current);
    parentTimer.current = setTimeout(() => {
      const patch = parentPatch.current;
      parentPatch.current = {};
      run(() => supabase.from('profiles').update(patch).eq('id', userId));
    }, 600);
  }, [userId, run]);

  // onSaved: görevler sunucuya yazılınca kimlikleriyle çağrılır (ör. uzman önerisine task_id yazmak için)
  const addTasks = useCallback((list: Omit<Task, 'id' | 'sortOrder'>[], onSaved?: (ids: string[]) => void) => {
    track('task.create', { n: list.length });
    const f = fid.current;
    if (!f) return;
    const now = Date.now() / 1000;
    const created: Task[] = list.map((x, i) => ({ ...x, id: uuid(), sortOrder: now + i / 1000 }));
    setTasks((p) => [...p, ...created]);
    run(async () => {
      const ins = await supabase.from('tasks').insert(
        created.map((t) => ({ ...taskRow(t), id: t.id, family_id: f, created_by: userId })),
      );
      if (ins.error) return ins;
      // Yalnız ebeveyne atanan görevde çocuk ataması yok (ortak akislar.md 18)
      const rows = created.flatMap((t) => assignmentRows(f, t.id, t.assignments));
      const a = rows.length ? await supabase.from('task_assignments').insert(rows) : { error: null };
      if (!a.error) onSaved?.(created.map((t) => t.id));
      return a;
    });
  }, [run, userId]);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    const f = fid.current;
    if (!f) return;
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    run(async () => {
      const row = taskRow(patch);
      if (Object.keys(row).length) {
        const up = await supabase.from('tasks').update(row).eq('id', id);
        if (up.error) return up;
      }
      if (patch.assignments) {
        const keep = patch.assignments.map((a) => a.childId);
        let del = supabase.from('task_assignments').delete().eq('task_id', id);
        if (keep.length) del = del.not('child_id', 'in', `(${keep.join(',')})`);
        const d = await del;
        if (d.error) return d;
        return supabase.from('task_assignments').upsert(assignmentRows(f, id, patch.assignments));
      }
      return { error: null };
    });
  }, [run]);

  // Sürükle-bırak: bu görevlerin mevcut sıra değerleri yeni sıraya göre yeniden dağıtılır;
  // listede olmayan (başka günlerdeki) görevlerin yeri değişmez.
  const reorderTasks = useCallback((orderedIds: string[]) => {
    const current = tasksRef.current;
    const slots = orderedIds
      .map((id) => current.find((t) => t.id === id)?.sortOrder)
      .filter((x): x is number => x !== undefined)
      .sort((a, b) => a - b);
    if (slots.length !== orderedIds.length) return;
    // Aynı değer varsa ayır
    for (let i = 1; i < slots.length; i++) if (slots[i] <= slots[i - 1]) slots[i] = slots[i - 1] + 0.001;
    const next: Record<string, number> = {};
    orderedIds.forEach((id, i) => { next[id] = slots[i]; });
    const changed = orderedIds.filter((id) => current.find((t) => t.id === id)!.sortOrder !== next[id]);
    if (!changed.length) return;
    setTasks((p) => p.map((t) => (t.id in next ? { ...t, sortOrder: next[t.id] } : t)).sort(bySortOrder));
    run(async () => {
      const results = await Promise.all(
        changed.map((id) => supabase.from('tasks').update({ sort_order: next[id] }).eq('id', id)),
      );
      return results.find((r) => r.error) ?? { error: null };
    });
  }, [run]);

  const deleteTask = useCallback((id: string) => {
    track('task.delete');
    setTasks((p) => p.filter((t) => t.id !== id));
    setCompletions((p) => {
      const n: Completions = {};
      Object.entries(p).forEach(([k, v]) => { if (!k.startsWith(`${id}|`)) n[k] = v; });
      return n;
    });
    run(() => supabase.from('tasks').delete().eq('id', id));
  }, [run]);

  const toggleCompletion = useCallback((task: Task, childId: string, date: string) => {
    const f = fid.current;
    if (!f) return;
    const key = completionKey(task.id, childId, date);
    const exists = !!completionsRef.current[key];
    const status: CompletionStatus = task.requiresReview ? 'pending' : 'approved';
    setCompletions((p) => {
      const n = { ...p };
      if (exists) delete n[key];
      else n[key] = status;
      return n;
    });
    if (exists) {
      run(() => supabase.from('completions').delete().match({ task_id: task.id, child_id: childId, date }));
    } else {
      run(() => supabase.from('completions').upsert(
        { family_id: f, task_id: task.id, child_id: childId, date, status },
        { onConflict: 'task_id,child_id,date' },
      ));
    }
  }, [run]);

  const review = useCallback(async (key: string, decision: ReviewDecision, extra: ReviewExtra = {}) => {
    track('task.review', { approve: decision === 'approved', decision, ...(extra.motivation ? { motivation: extra.motivation } : {}) });
    const [taskId, childId, date] = key.split('|');
    const prev = completionsRef.current[key];
    setCompletions((p) => ({ ...p, [key]: decision }));
    // Onay da ret de aynı RPC ile (ortak/sozlesme/durumlar.md D2). Ret kaydı silinmez: çocuk oyunda "reddedildi" ve notu görür.
    const base = { p_task_id: taskId, p_child_id: childId, p_date: date, p_status: decision, p_note: extra.note?.trim() || null };
    const more = extra.motivation != null || extra.stones != null;
    let { error } = await supabase.rpc('review_completion', more
      ? { ...base, p_motivation: extra.motivation ?? null, p_stones: decision === 'approved' ? extra.stones ?? null : null }
      : base);
    // Sunucu henüz eski (öneri 20261027130000 uygulanmadı): motivasyon/taş olmadan yeniden dene; "Tekrar dene" yok
    if (error && more && decision !== 'retry' && error.code === 'PGRST202') ({ error } = await supabase.rpc('review_completion', base));
    if (!error) return true;
    setCompletions((p) => { const n = { ...p }; if (prev) n[key] = prev; else delete n[key]; return n; });
    const old = decision === 'retry' && (error.code === 'PGRST202' || /Geçersiz durum|completions_status_check/.test(error.message));
    Alert.alert(old ? 'Sunucu güncellemesi bekleniyor' : 'Kaydedilemedi',
      old ? '"Tekrar dene", ortak SQL dosyası Supabase\'de çalıştırılınca açılır. Şimdilik onaylayabilir ya da reddedebilirsin.' : error.message);
    return false;
  }, []);

  const toggleSaved = useCallback((templateId: string) => {
    const f = fid.current;
    if (!f) return;
    const row = savedRows.find((r) => r.template_key === templateId);
    if (row?.is_custom) {
      const saved = !row.saved;
      setSavedRows((p) => p.map((r) => (r.id === row.id ? { ...r, saved } : r)));
      run(() => supabase.from('saved_templates').update({ saved }).eq('id', row.id));
    } else if (row) {
      setSavedRows((p) => p.filter((r) => r.id !== row.id));
      run(() => supabase.from('saved_templates').delete().eq('id', row.id));
    } else {
      const r = { id: uuid(), family_id: f, template_key: templateId, is_custom: false, saved: true, created_by: userId };
      setSavedRows((p) => [...p, r]);
      run(() => supabase.from('saved_templates').insert(r));
    }
  }, [savedRows, run, userId]);

  const addCustomTemplate = useCallback((t: CustomTemplateInput) => {
    track('template.custom');
    const f = fid.current;
    const id = uuid();
    if (!f) return id;
    const r = {
      id, family_id: f, template_key: id, is_custom: true, saved: true, created_by: userId,
      title: t.title, emoji: t.emoji, category: t.category, difficulty: t.difficulty, skill: categorySkill[t.category],
    };
    setSavedRows((p) => [...p, r]);
    run(() => supabase.from('saved_templates').insert(r));
    return id;
  }, [run, userId]);

  const sendMessage = useCallback((childId: string, text: string) => {
    track('message.send', { kind: 'text' });
    const f = fid.current;
    if (!f || !userId) return;
    const m: Message = { id: uuid(), childId, text, at: new Date().toISOString(), sender: 'parent', kind: 'text' };
    setMessages((p) => [...p, m]);
    run(() => supabase.from('messages').insert({
      id: m.id, family_id: f, child_id: childId, sender: 'parent', sender_id: userId, kind: 'text', body: text,
    }));
  }, [run, userId]);

  const sendSticker = useCallback((childId: string, key: string) => {
    track('message.send', { kind: 'sticker' });
    const f = fid.current;
    if (!f || !userId) return;
    const m: Message = { id: uuid(), childId, text: key, at: new Date().toISOString(), sender: 'parent', kind: 'sticker' };
    setMessages((p) => [...p, m]);
    run(() => supabase.from('messages').insert({
      id: m.id, family_id: f, child_id: childId, sender: 'parent', sender_id: userId, kind: 'sticker', body: key,
    }));
  }, [run, userId]);

  // Sohbet açılınca çocuğun mesajları okundu (çocuk oyunda "görüldü"yü görebilir)
  const markThreadRead = useCallback((childId: string) => {
    const unread = messagesRef.current.some((m) => m.childId === childId && m.sender === 'child' && !m.readAt);
    if (!unread) return;
    const at = new Date().toISOString();
    setMessages((p) => p.map((m) => (m.childId === childId && m.sender === 'child' && !m.readAt ? { ...m, readAt: at } : m)));
    supabase.rpc('mark_messages_read', { p_child_id: childId }).then(() => {}, () => {});
  }, []);

  // Fotoğraf / ses: önce Storage'a yükle, sonra mesaj kaydını ekle.
  // Ekranda yerel dosya hemen görünür; hata olursa mesaj geri alınır.
  const sendMedia = useCallback(async (
    childId: string, localUri: string, kind: 'image' | 'audio', contentType: string, durationMs?: number,
  ) => {
    track('message.send', { kind });
    const f = fid.current;
    if (!f || !userId) return;
    const id = uuid();
    const path = `${f}/${id}.${extFor(contentType)}`;
    const m: Message = {
      id, childId, text: '', at: new Date().toISOString(), sender: 'parent', kind,
      mediaPath: path, mediaUrl: localUri, durationMs,
    };
    setMessages((p) => [...p, m]);
    sendingIds.current.add(id);
    try {
      const body = await readFileBytes(localUri);
      const up = await supabase.storage.from(MAIL_BUCKET).upload(path, body, { contentType, upsert: false });
      if (up.error) throw up.error;
      const ins = await supabase.from('messages').insert({
        id, family_id: f, child_id: childId, sender: 'parent', sender_id: userId, kind,
        media_path: path, duration_ms: durationMs ?? null,
      });
      if (ins.error) {
        await supabase.storage.from(MAIL_BUCKET).remove([path]);
        throw toAppError(ins.error);
      }
    } catch (e) {
      setMessages((p) => p.filter((x) => x.id !== id));
      if ((e as { hint?: string }).hint === 'premium_required') requestPremium((e as Error).message);
      else Alert.alert('Gönderilemedi', (e as Error).message ?? 'Tekrar dene.');
    } finally {
      sendingIds.current.delete(id);
    }
  }, [userId]);

  const sendPhoto = useCallback(
    (childId: string, localUri: string, mimeType?: string) =>
      sendMedia(childId, localUri, 'image', mimeType?.startsWith('image/') ? mimeType : 'image/jpeg'),
    [sendMedia],
  );

  const sendVoice = useCallback(
    (childId: string, localUri: string, durationMs: number) =>
      sendMedia(childId, localUri, 'audio', 'audio/mp4', Math.round(durationMs)),
    [sendMedia],
  );

  const issueCode = useCallback(async (kind: 'parent' | 'child', childId?: string): Promise<IssuedCode> => {
    track('invite.create', { kind });
    const { data, error } = await supabase.rpc('create_invite_code', { p_kind: kind, p_child_id: childId ?? null });
    const row = Array.isArray(data) ? data[0] : data;
    if (error) throw toAppError(error);
    if (!row) throw new Error('Kod üretilemedi');
    return { code: row.code, expiresAt: row.expires_at };
  }, []);

  const createInviteCode = useCallback(async () => {
    const c = await issueCode('parent');
    setInviteCodes((p) => [...p, { code: c.code, createdAt: new Date().toISOString(), expiresAt: c.expiresAt }]);
    return c;
  }, [issueCode]);

  const createChildCode = useCallback((childId: string) => issueCode('child', childId), [issueCode]);

  // İkinci ebeveyn: davet koduyla aileye katıl
  const joinFamily = useCallback(async (code: string) => {
    track('family.join');
    // Kod hatası (süresi doldu / kullanıldı / çok deneme) açık metinle gelir: ortak/sozlesme/durumlar.md 11
    const { error } = await supabase.rpc('join_family', { p_code: code.trim().toUpperCase() });
    if (error) throw toAppError(error);
    await refresh();
  }, [refresh]);

  // Ailede başka ebeveyn var mı?
  const isOnlyParent = useCallback(async () => {
    const f = fid.current;
    if (!f) return true;
    const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('family_id', f);
    if (error) throw new Error(error.message);
    return (count ?? 0) <= 1;
  }, []);

  // Hesabı ve (tek ebeveynse) ailenin tüm verisini kalıcı olarak sil
  // Klasörü alt klasörleriyle birlikte boşalt (Storage listesinde klasörlerin id'si yoktur)
  const removeFolder = async (bucketName: string, prefix: string): Promise<void> => {
    const bucket = supabase.storage.from(bucketName);
    for (;;) {
      const { data, error } = await bucket.list(prefix, { limit: 100 });
      if (error) throw new Error(error.message);
      const files = (data ?? []).filter((o: any) => o.id);
      const folders = (data ?? []).filter((o: any) => !o.id);
      for (const d of folders) await removeFolder(bucketName, `${prefix}/${d.name}`);
      if (!files.length) break;
      const rm = await bucket.remove(files.map((o) => `${prefix}/${o.name}`));
      if (rm.error) throw new Error(rm.error.message);
      if (!rm.data?.length) break; // silinemeyen dosya kaldıysa döngüye girme
    }
  };

  const deleteAccount = useCallback(async () => {
    const f = fid.current;
    if (f && (await isOnlyParent())) {
      // Storage dosyaları veritabanından silinemez; önce Storage API ile silinir:
      // mesaj medyası ve çocuk fotoğrafları ('mail', alt klasör avatars/ dahil), zor an sesleri ('abc')
      await removeFolder(MAIL_BUCKET, f);
      await removeFolder('abc', f);
    }
    const { error } = await supabase.rpc('delete_account');
    if (error) throw new Error(error.message);
  }, [isOnlyParent]);

  const savedIds = useMemo(() => savedRows.filter((r) => r.saved).map((r) => r.template_key as string), [savedRows]);

  const customTemplates = useMemo<Template[]>(
    () => savedRows.filter((r) => r.is_custom).map((r) => ({
      id: r.template_key, title: r.title, emoji: r.emoji ?? '⭐', category: toCategory(r.category),
      categories: [toCategory(r.category)], difficulty: r.difficulty as Difficulty,
      coins: difficultyMeta[r.difficulty as Difficulty]?.coins ?? 5,
      // Eski kayıtta serbest metin olabilir; anahtar değilse kategorinin becerisi
      skill: r.skill && r.skill in skillLabels ? r.skill : categorySkill[toCategory(r.category)], sort: -1, custom: true,
    })),
    [savedRows],
  );

  const allTemplates = useMemo(() => [...customTemplates, ...baseTemplates], [customTemplates]);

  const value: Store = {
    ready, familyId,
    parent, children, tasks, completions, messages, savedIds, customTemplates, inviteCodes,
    addChild, renameChild, setChildAvatar, setChildAgeBand, childBalance, unlinkChildDevice, updateParent, addTasks, reorderTasks, updateTask, deleteTask, toggleCompletion, review,
    toggleSaved, addCustomTemplate, allTemplates, sendMessage, sendSticker, markThreadRead, sendPhoto, sendVoice, createInviteCode, createChildCode, joinFamily, refresh,
    isOnlyParent, deleteAccount,
  };
  return <Ctx.Provider value={value}>{kids}</Ctx.Provider>;
}

export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider eksik');
  return v;
};

export { fromISO, toISO, todayISO };
