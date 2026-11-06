import { supabase } from './supabase';
import { AppError } from './errors';
import { isMissingRpc } from './clinic';

// Ebeveyn eğitimi: Gelişim › Ben (ortak/sozlesme/akislar.md 22, öneri 20261105200000_parent_lessons.sql, ekonomi.md 5C).
// Kısa dersler; "Bugün uyguladım" uygulanan güne 1 Güneş Taşı, haftada en çok 3. Sunucuda işlev yoksa null döner
// (ekran "Yakında" kartı gösterir, başka hiçbir şey etkilenmez).

export type Lesson = { key: string; title: string; summary: string; minutes: number; tryText: string; domain: string; retired: boolean };
export type LessonAssigned = { id: string; lessonKey: string; linkId: string; note: string; createdAt: string };
export type LessonMine = {
  lessonKey: string; status: 'current' | 'learned' | 'paused'; assignmentId: string | null;
  startedAt: string; openedAt: string | null; learnedAt: string | null; days: number; weekDays: string[];
};
export type LessonsState = {
  today: string; weekStart: string; catalog: Lesson[]; assigned: LessonAssigned[]; mine: LessonMine[];
  weekPracticed: number; weekStones: number; weekCap: number; balance: number;
};
export type PracticeResult = { day: string; weekDays: string[]; weekPracticed: number; weekStones: number; weekCap: number; stoneGiven: number; balance: number };

const toState = (d: any): LessonsState => ({
  today: d.today, weekStart: d.week_start,
  catalog: (d.catalog ?? []).map((l: any) => ({ key: l.key, title: l.title, summary: l.summary ?? '', minutes: l.minutes ?? 4,
    tryText: l.try_text ?? '', domain: l.domain ?? 'general', retired: l.status === 'retired' })),
  assigned: (d.assigned ?? []).map((a: any) => ({ id: a.id, lessonKey: a.lesson_key, linkId: a.link_id, note: a.note ?? '', createdAt: a.created_at })),
  mine: (d.mine ?? []).map((m: any) => ({ lessonKey: m.lesson_key, status: m.status, assignmentId: m.assignment_id ?? null,
    startedAt: m.started_at, openedAt: m.opened_at ?? null, learnedAt: m.learned_at ?? null, days: m.days ?? 0, weekDays: m.week_days ?? [] })),
  weekPracticed: d.week_practiced ?? 0, weekStones: d.week_stones ?? 0, weekCap: d.week_cap ?? 3, balance: d.balance ?? 0,
});

const fail = (e: { message: string; hint?: string | null }) => new AppError(e.message, e.hint);

export async function familyLessons(): Promise<LessonsState | null> {
  const { data, error } = await supabase.rpc('family_lessons');
  if (error) { if (isMissingRpc(error)) return null; throw fail(error); }
  return toState(data);
}

export async function startLesson(key: string): Promise<LessonsState> {
  const { data, error } = await supabase.rpc('parent_lesson_start', { p_key: key });
  if (error) throw fail(error);
  return toState(data);
}

export async function finishLesson(key: string): Promise<LessonsState> {
  const { data, error } = await supabase.rpc('parent_lesson_finish', { p_key: key });
  if (error) throw fail(error);
  return toState(data);
}

export async function openLesson(key: string) {
  await supabase.rpc('parent_lesson_open', { p_key: key });
}

export async function practiceLesson(key: string, done: boolean, day?: string): Promise<PracticeResult> {
  const { data, error } = await supabase.rpc('parent_lesson_practice', { p_key: key, p_day: day ?? null, p_done: done });
  if (error) throw fail(error);
  return { day: data.day, weekDays: data.week_days ?? [], weekPracticed: data.week_practiced ?? 0, weekStones: data.week_stones ?? 0,
    weekCap: data.week_cap ?? 3, stoneGiven: data.stone_given ?? 0, balance: data.balance ?? 0 };
}

export async function lessonBody(key: string): Promise<string> {
  const { data, error } = await supabase.from('parent_lessons').select('body_md').eq('key', key).maybeSingle();
  if (error) throw fail(error);
  return (data as any)?.body_md ?? '';
}

export const lessonError = (e: unknown) => {
  const hint = (e as AppError | undefined)?.hint;
  if (hint === 'lesson_not_found') return 'Bu ders artık yok.';
  if (hint === 'lesson_not_started') return 'Önce bu derse başla.';
  if (hint === 'date_range') return 'Yalnız son bir haftanın günü işaretlenebilir.';
  return 'Şu an kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.';
};

// "Bu hafta" şeridi: 5 nokta (hedef 5 gün); 5'ten fazla gün de 5 dolu
export const WEEK_DOTS = 5;
