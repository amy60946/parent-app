import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';
import { isMissingRpc } from './clinic';
import { useAuth } from './auth';
import LIB from '../data/trainingLibrary.json';

// Ebeveyn eğitimi (kullanıcı isteği 9 Kasım 2026: rakibin aile uygulamasındaki ekranlara sadık; ortak akislar.md 23,
// veritabani.md 32, durumlar.md P21, öneri 20261110100000_parent_trainings.sql). 5 Kasım ders düzeniyle (lessons.ts,
// Gelişim › Ben) BİRLEŞTİRİLMEDİ; kullanıcı "sonra değerlendiririz" dedi. Uzman eğitimi ClinicApp'te kurar, Etkin yapınca
// ebeveyn Ben › Derslere devam et'te görür. Sunucuda işlev yoksa (SQL uygulanmadı) null döner ve bölümler hiç görünmez.
// İçerik: src/data/trainingLibrary.json ← node tools/sync-training-library.mjs <ortak>/veri/ebeveyn_egitimi_kutuphane.json

export type ItemType = 'reading' | 'quiz' | 'short' | 'video' | 'pdf';
export type LibSection = { heading: string; paragraphs?: string[]; bullets?: string[] };
export type LibQuestion = { q: string; options: string[]; answer: number };
export type LibItem = {
  key: string; subject: string; type: ItemType; title: string; desc: string; topics: string[];
  minutes?: number; sections?: LibSection[]; questions?: LibQuestion[]; prompts?: string[];
};
const ITEMS: LibItem[] = (LIB as any).items;
const BY_KEY = new Map(ITEMS.map((i) => [i.key, i]));
export const itemByKey = (key: string): LibItem | undefined => BY_KEY.get(key);
// Ebeveyne görünen tür adı (rakipteki gibi; çoktan seçmeli ebeveyne "Test")
export const TYPE_WORD: Record<ItemType, string> = { reading: 'Okuma', quiz: 'Test', short: 'Açık uçlu', video: 'Video', pdf: 'PDF' };

export type Measure = 'frequency' | 'accuracy' | 'duration' | 'none';
// Modül yanıtları soru sırasıyla: test { pick }, açık uçlu { text } (ClinicApp "Etkileşimli modülü incele" aynı biçimi okur)
export type Answer = { pick?: number; text?: string };
export type TModule = { id: string; itemKey: string; completedAt: string | null; correct: number | null; total: number | null; answers: Answer[] | null };
export type TTask = { id: string; title: string; description: string; measure: Measure };
export type TLog = { id: string; taskId: string; day: string; count: number | null; successes: number | null; attempts: number | null; minutes: number | null; reflection: string; createdAt: string };
export type TTodo = { id: string; title: string; description: string; doneAt: string | null; rating: number | null; reflection: string; createdAt: string };
export type Training = {
  id: string; linkId: string; childId: string; childName: string; title: string; status: 'active' | 'mastered';
  startedAt: string; activatedAt: string | null; masteredAt: string | null; parentName: string;
  mine: boolean; // bana ya da ailedeki ebeveynlere atanmış: yalnız o zaman işlem yapılır (öteki ebeveyn görür, değiştiremez)
  modules: TModule[]; tasks: TTask[]; logs: TLog[]; todos: TTodo[];
};

const toTraining = (t: any): Training => ({
  id: t.id, linkId: t.link_id, childId: t.child_id, childName: t.child_name ?? '', title: t.title, status: t.status,
  startedAt: t.started_at, activatedAt: t.activated_at ?? null, masteredAt: t.mastered_at ?? null, parentName: t.parent_name ?? '', mine: !!t.mine,
  modules: (t.modules ?? []).map((m: any) => ({ id: m.id, itemKey: m.item_key, completedAt: m.completed_at ?? null, correct: m.correct ?? null, total: m.total ?? null, answers: m.answers ?? null })),
  tasks: (t.tasks ?? []).map((k: any) => ({ id: k.id, title: k.title, description: k.description ?? '', measure: k.measure ?? 'none' })),
  logs: (t.logs ?? []).map((g: any) => ({ id: g.id, taskId: g.task_id, day: g.day, count: g.count ?? null, successes: g.successes ?? null, attempts: g.attempts ?? null,
    minutes: g.minutes ?? null, reflection: g.reflection ?? '', createdAt: g.created_at })),
  todos: (t.todos ?? []).map((d: any) => ({ id: d.id, title: d.title, description: d.description ?? '', doneAt: d.done_at ?? null, rating: d.rating ?? null,
    reflection: d.reflection ?? '', createdAt: d.created_at })),
});

// Sunucu hataları işlevlerde `raise exception '<anahtar>'` ile gelir (ileti = anahtar)
class TrainingError extends Error {}
const fail = (e: { message: string }) => new TrainingError(e.message);

export async function familyTrainings(): Promise<Training[] | null> {
  const { data, error } = await supabase.rpc('family_trainings');
  if (error) { if (isMissingRpc(error)) return null; throw fail(error); }
  return ((data ?? []) as any[]).map(toTraining);
}

export async function completeModule(moduleId: string, r: { answers?: Answer[]; correct?: number; total?: number } = {}) {
  const { error } = await supabase.rpc('family_training_module_complete', {
    p_module: moduleId, p_answers: r.answers ?? null, p_correct: r.correct ?? null, p_total: r.total ?? null,
  });
  if (error) throw fail(error);
}

export async function logTask(taskId: string, v: { count?: number; successes?: number; attempts?: number; minutes?: number; reflection: string }) {
  const { error } = await supabase.rpc('family_training_log', {
    p_task: taskId, p_day: null, p_count: v.count ?? null, p_successes: v.successes ?? null, p_attempts: v.attempts ?? null,
    p_minutes: v.minutes ?? null, p_reflection: v.reflection,
  });
  if (error) throw fail(error);
}

export async function setTodo(todoId: string, done: boolean, rating?: number, reflection = '') {
  const { error } = await supabase.rpc('family_training_todo_set', { p_todo: todoId, p_done: done, p_rating: rating ?? null, p_reflection: reflection });
  if (error) throw fail(error);
}

export function trainingError(e: unknown): string {
  const m = (e as Error | undefined)?.message ?? '';
  if (/training_not_found/.test(m)) return 'Bu eğitim artık açık değil. Uzmanın eğitimi kapatmış ya da paylaşım bitmiş olabilir.';
  if (/count_required|attempts_required|minutes_required/.test(m)) return 'Sayıyı yaz, sonra gönder.';
  if (/day_out_of_range/.test(m)) return 'Yalnız bugünün ve son iki haftanın kaydı girilebilir.';
  if (/answers_invalid/.test(m)) return 'Yanıtlardan biri çok uzun (en çok 1000 karakter).';
  if (/score_invalid|rating_invalid/.test(m)) return 'Seçim geçersiz; tekrar dene.';
  return 'Şu an kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.';
}

// Modülleri kütüphanedeki içerikle eşle (kütüphanede olmayan anahtar atlanır: uygulama eskiyse yeni öğe görünmez)
export const moduleItems = (t: Training) => t.modules.map((m) => ({ m, it: itemByKey(m.itemKey) })).filter((x): x is { m: TModule; it: LibItem } => !!x.it);
export function trainingPct(t: Training) {
  const list = moduleItems(t);
  return list.length ? Math.round((list.filter((x) => x.m.completedAt).length / list.length) * 100) : 0;
}
// "Uzmanından n görev": uygulama görevleri + tamamlanmamış tek seferlik görevler (yalnız bana atanmış etkin eğitimler)
export const openTaskCount = (list: Training[]) =>
  list.filter((t) => t.mine && t.status === 'active').reduce((n, t) => n + t.tasks.length + t.todos.filter((d) => !d.doneAt).length, 0);

// Bütün ekranlar aynı listeyi paylaşır (Ben, Uzmanım, eğitim sayfası, oynatıcı); ekran öne gelince yenilenir.
// null = sunucuda yok (bölümler görünmez), undefined = yükleniyor. Hesap değişince liste sıfırlanır.
let cache: Training[] | null | undefined;
let cacheUser: string | undefined;
const subs = new Set<(v: Training[] | null) => void>();
const publish = (v: Training[] | null) => { cache = v; subs.forEach((f) => f(v)); };
export async function reloadTrainings() {
  const user = cacheUser;
  try { const v = await familyTrainings(); if (user === cacheUser) publish(v); } catch { if (cache === undefined && user === cacheUser) publish([]); }
}
export function patchTrainings(fn: (list: Training[]) => Training[]) { if (cache) publish(fn(cache)); }

export function useTrainings() {
  const uid = useAuth().session?.user.id;
  if (uid !== cacheUser) { cacheUser = uid; cache = undefined; }
  const [list, setList] = useState<Training[] | null | undefined>(cache);
  useFocusEffect(useCallback(() => {
    subs.add(setList);
    setList(cache);
    reloadTrainings();
    return () => { subs.delete(setList); };
  }, [uid]));
  return list;
}
