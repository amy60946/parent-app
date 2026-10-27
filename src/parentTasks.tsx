import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { supabase } from './lib/supabase';
import { useStore } from './store';
import { Difficulty } from './theme';
import { track } from './lib/track';

// Ebeveyn görevleri ve ebeveynin Güneş Taşı (ortak/sozlesme/akislar.md 18, öneri 20261027140000_parent_tasks_gifts.sql).
// Görev ebeveyne de atanır (kendine ya da eşine); ebeveyn "Yaptım" der, zorluğa göre taş kazanır, taşla çocuğa oyunda hediye yollar.
// Sunucuda tablo yoksa (öneri uygulanmadı) ready = false: ekranlar bu bölümleri göstermez, bugünkü akış sürer.

export type ParentAssign = { userId: string; difficulty: Difficulty };
export type Member = { id: string; nickname: string; name: string; avatar: string };
export type StoneRow = { id: number; userId: string; amount: number; reason: 'task' | 'task_undo' | 'gift'; ref: string;
  itemId?: string; childId?: string; createdAt: string };

type Ctx = {
  ready: boolean | null; // null: yükleniyor
  me: string | null;
  members: Member[]; // ailedeki ebeveynler, ben önce
  assigns: Record<string, ParentAssign[]>; // görev → ebeveyn atamaları
  done: Record<string, true>; // `${görev}|${kişi}|${gün}`
  ledger: StoneRow[]; // ailedeki ebeveynlerin taş hareketleri (yeni önce)
  balance: (userId: string) => number;
  saveAssigns: (taskId: string, list: ParentAssign[]) => Promise<boolean>;
  markDone: (taskId: string, date: string, done: boolean) => Promise<void>;
  reload: () => void;
};

const C = createContext<Ctx | null>(null);
export const doneKey = (taskId: string, userId: string, date: string) => `${taskId}|${userId}|${date}`;
export const memberName = (m?: Member) => (m ? m.nickname || m.name || 'Ebeveyn' : 'Ebeveyn');

export function ParentTasksProvider({ children }: { children: React.ReactNode }) {
  const { familyId, parent } = useStore();
  const me = parent.id || null;
  const [ready, setReady] = useState<boolean | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assigns, setAssigns] = useState<Record<string, ParentAssign[]>>({});
  const [done, setDone] = useState<Record<string, true>>({});
  const [ledger, setLedger] = useState<StoneRow[]>([]);

  const load = useCallback(async (f: string) => {
    const [pr, pa, pc, pl] = await Promise.all([
      supabase.from('profiles').select('id, nickname, name, avatar').eq('family_id', f),
      supabase.from('parent_assignments').select('task_id, user_id, difficulty').eq('family_id', f),
      supabase.from('parent_completions').select('task_id, user_id, date').eq('family_id', f),
      supabase.from('parent_stone_ledger').select('id, user_id, amount, reason, ref, item_id, child_id, created_at')
        .eq('family_id', f).order('created_at', { ascending: false }).limit(500),
    ]);
    if (!pr.error && pr.data) {
      const list = (pr.data as any[]).map((r) => ({ id: r.id, nickname: r.nickname ?? '', name: r.name ?? '', avatar: r.avatar ?? '' }));
      setMembers(list.sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0)));
    }
    if (pa.error) { setReady(false); return; }
    const a: Record<string, ParentAssign[]> = {};
    (pa.data as any[]).forEach((r) => { (a[r.task_id] ??= []).push({ userId: r.user_id, difficulty: r.difficulty }); });
    setAssigns(a);
    const d: Record<string, true> = {};
    ((pc.data ?? []) as any[]).forEach((r) => { d[doneKey(r.task_id, r.user_id, r.date)] = true; });
    setDone(d);
    setLedger(((pl.data ?? []) as any[]).map((r) => ({ id: r.id, userId: r.user_id, amount: r.amount, reason: r.reason, ref: r.ref,
      itemId: r.item_id ?? undefined, childId: r.child_id ?? undefined, createdAt: r.created_at }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setReady(true);
  }, [me]);

  useEffect(() => {
    setReady(null); setMembers([]); setAssigns({}); setDone({}); setLedger([]);
    if (!familyId) return;
    const f = familyId;
    load(f);
    let t: ReturnType<typeof setTimeout> | undefined;
    const later = () => { clearTimeout(t); t = setTimeout(() => load(f), 250); };
    const filter = `family_id=eq.${f}`;
    const ch = supabase.channel(`parent-tasks:${f}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parent_assignments', filter }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parent_completions', filter }, later)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'parent_stone_ledger', filter }, later)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter }, later)
      .subscribe();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') later(); });
    return () => { clearTimeout(t); supabase.removeChannel(ch); sub.remove(); };
  }, [familyId, load]);

  const balance = useCallback((userId: string) =>
    Math.max(0, ledger.filter((r) => r.userId === userId).reduce((s, r) => s + r.amount, 0)), [ledger]);

  // Görevin ebeveyn atamalarını verilen listeye eşitle (yeni görevde de, düzenlemede de)
  const saveAssigns = useCallback(async (taskId: string, list: ParentAssign[]) => {
    if (!familyId || ready === false) return list.length === 0;
    const prev = assigns[taskId] ?? [];
    setAssigns((p) => ({ ...p, [taskId]: list }));
    const keep = list.map((x) => x.userId);
    let del = supabase.from('parent_assignments').delete().eq('task_id', taskId);
    if (keep.length) del = del.not('user_id', 'in', `(${keep.join(',')})`);
    const d = prev.some((x) => !keep.includes(x.userId)) ? await del : { error: null };
    const u = !d.error && list.length
      ? await supabase.from('parent_assignments').upsert(list.map((x) => ({ task_id: taskId, user_id: x.userId, family_id: familyId, difficulty: x.difficulty })))
      : { error: d.error };
    if (u.error) {
      setAssigns((p) => ({ ...p, [taskId]: prev }));
      Alert.alert('Ebeveyn ataması kaydedilemedi', u.error.message);
      return false;
    }
    return true;
  }, [familyId, ready, assigns]);

  const markDone = useCallback(async (taskId: string, date: string, on: boolean) => {
    if (!me) return;
    track('task.parent_done', { on });
    const k = doneKey(taskId, me, date);
    setDone((p) => { const n = { ...p }; if (on) n[k] = true; else delete n[k]; return n; });
    const { error } = await supabase.rpc('parent_task_done', { p_task_id: taskId, p_date: date, p_done: on });
    if (error) {
      setDone((p) => { const n = { ...p }; if (on) delete n[k]; else n[k] = true; return n; });
      Alert.alert('Kaydedilemedi', error.message);
    }
    if (familyId) load(familyId);
  }, [me, familyId, load]);

  const reload = useCallback(() => { if (familyId) load(familyId); }, [familyId, load]);
  const value = useMemo(() => ({ ready, me, members, assigns, done, ledger, balance, saveAssigns, markDone, reload }),
    [ready, me, members, assigns, done, ledger, balance, saveAssigns, markDone, reload]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useParentTasks = () => {
  const v = useContext(C);
  if (!v) throw new Error('ParentTasksProvider eksik');
  return v;
};
