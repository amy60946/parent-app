import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Difficulty } from './theme';
import { Template, Category, templates as baseTemplates } from './data/templates';
import { fromISO, toISO, todayISO } from './dates';
import { supabase } from './lib/supabase';
import { uuid } from './lib/uuid';

export type Child = {
  id: string;
  name: string;
  avatar: string;
  gender?: 'kız' | 'erkek';
  birthday?: string; // ISO
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
  recurring: boolean; // true: her gün tekrar eder
  endDate?: string;
  reminder?: string; // HH:MM
  requiresReview: boolean;
};

export type CompletionStatus = 'pending' | 'approved';
// anahtar: `${taskId}|${childId}|${date}`
export type Completions = Record<string, CompletionStatus>;

export type Message = { id: string; childId: string; text: string; at: string };

export type InviteCode = { code: string; createdAt: string };

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
  addChild: (c: Omit<Child, 'id'>) => void;
  updateParent: (p: Partial<Parent>) => void;
  addTasks: (t: Omit<Task, 'id'>[]) => void;
  updateTask: (id: string, patch: Partial<Task>) => void; // tekrarlayan görevde tek kayıt => tüm günlere yansır
  deleteTask: (id: string) => void;
  toggleCompletion: (task: Task, childId: string, date: string) => void;
  review: (key: string, approve: boolean) => void;
  toggleSaved: (templateId: string) => void;
  addCustomTemplate: (t: Omit<Template, 'id' | 'usedBy' | 'custom'>) => string;
  allTemplates: Template[];
  sendMessage: (childId: string, text: string) => void;
  createInviteCode: () => Promise<string>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export const completionKey = (taskId: string, childId: string, date: string) =>
  `${taskId}|${childId}|${date}`;

export const taskOccursOn = (task: Task, date: string) => {
  if (date < task.startDate) return false;
  if (!task.recurring) return date === task.startDate;
  return !task.endDate || date <= task.endDate;
};

/* ---------- Veritabanı satırı <-> uygulama nesnesi ---------- */

type Row = Record<string, any>;

const toChild = (r: Row): Child => ({
  id: r.id,
  name: r.name,
  avatar: r.avatar,
  gender: r.gender ?? undefined,
  birthday: r.birthday ?? undefined,
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
  endDate: r.end_date ?? undefined,
  reminder: r.reminder ?? undefined,
  requiresReview: r.requires_review,
});

const taskRow = (t: Partial<Task>) => {
  const r: Row = {};
  if (t.title !== undefined) r.title = t.title;
  if (t.emoji !== undefined) r.emoji = t.emoji;
  if (t.skill !== undefined) r.skill = t.skill;
  if (t.description !== undefined) r.description = t.description;
  if (t.startDate !== undefined) r.start_date = t.startDate;
  if (t.recurring !== undefined) r.recurring = t.recurring;
  if ('endDate' in t) r.end_date = t.endDate ?? null;
  if ('reminder' in t) r.reminder = t.reminder ?? null;
  if (t.requiresReview !== undefined) r.requires_review = t.requiresReview;
  return r;
};

const assignmentRows = (familyId: string, taskId: string, list: Assignment[]) =>
  list.map((a) => ({ task_id: taskId, child_id: a.childId, family_id: familyId, difficulty: a.difficulty, coins: a.coins }));

const toMessage = (r: Row): Message => ({ id: r.id, childId: r.child_id, text: r.body ?? '', at: r.created_at });

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
    if (!error && data) setTasks(data.map(toTask));
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
    if (!error && data) setMessages(data.map(toMessage));
  }, []);

  const loadSaved = useCallback(async (f: string) => {
    const { data, error } = await supabase.from('saved_templates').select('*').eq('family_id', f).order('created_at');
    if (!error && data) setSavedRows(data);
  }, []);

  const loadCodes = useCallback(async (f: string) => {
    const { data, error } = await supabase
      .from('invite_codes').select('code, created_at').eq('family_id', f).eq('kind', 'parent').order('created_at');
    if (!error && data) setInviteCodes(data.map((r) => ({ code: r.code, createdAt: r.created_at })));
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, (p) => {
        const m = toMessage(p.new as Row);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
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

  /* --- yazma --- */

  // Sunucu hatasında kullanıcıyı uyar ve ekranı sunucudaki gerçek veriyle eşitle.
  const run = useCallback(
    async (op: () => PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await op();
      if (error) {
        Alert.alert('Kaydedilemedi', error.message);
        refresh();
      }
    },
    [refresh],
  );

  const addChild = useCallback((c: Omit<Child, 'id'>) => {
    const f = fid.current;
    if (!f) return;
    const child: Child = { ...c, id: uuid() };
    setChildren((p) => [...p, child]);
    run(() => supabase.from('children').insert({
      id: child.id, family_id: f, name: c.name, avatar: c.avatar, gender: c.gender ?? null, birthday: c.birthday ?? null,
    }));
  }, [run]);

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

  const addTasks = useCallback((list: Omit<Task, 'id'>[]) => {
    const f = fid.current;
    if (!f) return;
    const created: Task[] = list.map((x) => ({ ...x, id: uuid() }));
    setTasks((p) => [...p, ...created]);
    run(async () => {
      const ins = await supabase.from('tasks').insert(
        created.map((t) => ({ ...taskRow(t), id: t.id, family_id: f, created_by: userId })),
      );
      if (ins.error) return ins;
      return supabase.from('task_assignments').insert(created.flatMap((t) => assignmentRows(f, t.id, t.assignments)));
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

  const deleteTask = useCallback((id: string) => {
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

  const review = useCallback((key: string, approve: boolean) => {
    const [taskId, childId, date] = key.split('|');
    setCompletions((p) => {
      const n = { ...p };
      if (approve) n[key] = 'approved';
      else delete n[key];
      return n;
    });
    const match = { task_id: taskId, child_id: childId, date };
    if (approve) {
      run(() => supabase.from('completions')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: userId })
        .match(match));
    } else {
      run(() => supabase.from('completions').delete().match(match));
    }
  }, [run, userId]);

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

  const addCustomTemplate = useCallback((t: Omit<Template, 'id' | 'usedBy' | 'custom'>) => {
    const f = fid.current;
    const id = uuid();
    if (!f) return id;
    const r = {
      id, family_id: f, template_key: id, is_custom: true, saved: true, created_by: userId,
      title: t.title, emoji: t.emoji, category: t.category, difficulty: t.difficulty, skill: t.skill,
    };
    setSavedRows((p) => [...p, r]);
    run(() => supabase.from('saved_templates').insert(r));
    return id;
  }, [run, userId]);

  const sendMessage = useCallback((childId: string, text: string) => {
    const f = fid.current;
    if (!f || !userId) return;
    const m: Message = { id: uuid(), childId, text, at: new Date().toISOString() };
    setMessages((p) => [...p, m]);
    run(() => supabase.from('messages').insert({
      id: m.id, family_id: f, child_id: childId, sender: 'parent', sender_id: userId, kind: 'text', body: text,
    }));
  }, [run, userId]);

  const createInviteCode = useCallback(async () => {
    const { data, error } = await supabase.rpc('create_invite_code', { p_kind: 'parent' });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw new Error(error?.message ?? 'Kod üretilemedi');
    setInviteCodes((p) => [...p, { code: row.code, createdAt: new Date().toISOString() }]);
    return row.code as string;
  }, []);

  const savedIds = useMemo(() => savedRows.filter((r) => r.saved).map((r) => r.template_key as string), [savedRows]);

  const customTemplates = useMemo<Template[]>(
    () => savedRows.filter((r) => r.is_custom).map((r) => ({
      id: r.template_key, title: r.title, emoji: r.emoji ?? '⭐', category: r.category as Category,
      difficulty: r.difficulty as Difficulty, skill: r.skill ?? 'Özel', usedBy: 0, custom: true,
    })),
    [savedRows],
  );

  const allTemplates = useMemo(() => [...customTemplates, ...baseTemplates], [customTemplates]);

  const value: Store = {
    ready, familyId,
    parent, children, tasks, completions, messages, savedIds, customTemplates, inviteCodes,
    addChild, updateParent, addTasks, updateTask, deleteTask, toggleCompletion, review,
    toggleSaved, addCustomTemplate, allTemplates, sendMessage, createInviteCode, refresh,
  };
  return <Ctx.Provider value={value}>{kids}</Ctx.Provider>;
}

export const useStore = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider eksik');
  return v;
};

export { fromISO, toISO, todayISO };
