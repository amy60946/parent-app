import { supabase } from './supabase';
import { readFileBytes } from './files';
import { uuid } from './uuid';
import { DayPart, dayPartHour } from '../data/dayParts';
import { fail } from './errors';
import { track } from './track';

// Zor an kayıtları (abc_events): aynı olay birden çok çocuğu ilgilendiriyorsa her çocuğa bir satır, ortak group_id.
// Ses: Storage 'abc' kovası, <family_id>/<dosya>.m4a — uzman yalnız rızalı çocuğun kaydına bağlı sesi dinler.
// Kurallar: ortak/supabase/proposed/20261019140000_parent_features.sql
const BUCKET = 'abc';

export type AbcEvent = {
  key: string; // group_id ya da tek satırın id'si
  ids: string[];
  childIds: string[];
  occurredAt: string;
  dayPart: DayPart;
  antecedent: string;
  behavior: string;
  consequence: string;
  intensity: number;
  audioPath?: string;
  audioUrl?: string;
  durationMs?: number;
  goals: Record<string, string>; // çocuk → uzmanın hedefi (goal_id; ortak proposed/20261103120000_abc_goal.sql)
};

export type AbcInput = {
  childIds: string[]; date: string; dayPart: DayPart;
  antecedent: string; behavior: string; consequence: string; intensity: number;
  audio?: { uri: string; durationMs: number };
  goals?: Record<string, string>; // isteğe bağlı: çocuk → hedef ("Hangi hedefle ilgili?")
};



// Seçilen gün + gün bölümünün temsil saati (yerel saat)
const occurredAt = (date: string, part: DayPart) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, dayPartHour[part], 0, 0).toISOString();
};

export async function listAbc(familyId: string): Promise<AbcEvent[]> {
  const { data, error } = await supabase.from('abc_events').select('*')
    .eq('family_id', familyId).order('occurred_at', { ascending: false }).limit(300);
  fail(error);
  const groups = new Map<string, AbcEvent>();
  (data ?? []).forEach((r: any) => {
    const key = r.group_id ?? r.id;
    const g = groups.get(key);
    if (g) { g.ids.push(r.id); g.childIds.push(r.child_id); if (r.goal_id) g.goals[r.child_id] = r.goal_id; return; }
    groups.set(key, {
      key, ids: [r.id], childIds: [r.child_id], occurredAt: r.occurred_at, dayPart: r.day_part ?? 'evening',
      antecedent: r.antecedent ?? '', behavior: r.behavior, consequence: r.consequence ?? '', intensity: r.intensity,
      audioPath: r.audio_path ?? undefined, durationMs: r.duration_ms ?? undefined, goals: r.goal_id ? { [r.child_id]: r.goal_id } : {},
    });
  });
  const list = [...groups.values()].sort((x, y) => y.occurredAt.localeCompare(x.occurredAt));
  const paths = [...new Set(list.map((e) => e.audioPath).filter(Boolean))] as string[];
  if (paths.length) {
    const { data: urls } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    const byPath = new Map((urls ?? []).map((u: any) => [u.path, u.signedUrl]));
    list.forEach((e) => { if (e.audioPath) e.audioUrl = byPath.get(e.audioPath) ?? undefined; });
  }
  return list;
}

export async function addAbc(familyId: string, userId: string | undefined, e: AbcInput) {
  track('observation.create');
  let audioPath: string | null = null;
  if (e.audio) {
    audioPath = `${familyId}/${uuid()}.m4a`;
    const body = await readFileBytes(e.audio.uri);
    const up = await supabase.storage.from(BUCKET).upload(audioPath, body, { contentType: 'audio/mp4', upsert: false });
    fail(up.error);
  }
  const group = e.childIds.length > 1 ? uuid() : null;
  // Tek INSERT: uzmana tek bildirim gider. Hedef yalnız seçildiyse yazılır (sunucu güncellemesi yoksa hedefsiz yeniden denenir).
  const rows = (withGoal: boolean) => e.childIds.map((childId) => ({
    family_id: familyId, child_id: childId, group_id: group, occurred_at: occurredAt(e.date, e.dayPart), day_part: e.dayPart,
    antecedent: e.antecedent.trim(), behavior: e.behavior.trim(), consequence: e.consequence.trim(), intensity: e.intensity,
    audio_path: audioPath, duration_ms: e.audio ? Math.round(e.audio.durationMs) : null, created_by: userId ?? null,
    ...(withGoal && e.goals?.[childId] ? { goal_id: e.goals[childId] } : {}),
  }));
  const withGoal = !!e.goals && Object.values(e.goals).some(Boolean);
  let { error } = await supabase.from('abc_events').insert(rows(withGoal));
  // Hedef sütunu yoksa ya da hedef bu arada paylaşımdan çıktıysa (goal_mismatch) kayıt kaybolmasın: hedefsiz kaydet
  if (error && withGoal && (/goal_id/.test(error.message ?? '') || (error as { hint?: string }).hint === 'goal_mismatch')) {
    ({ error } = await supabase.from('abc_events').insert(rows(false)));
  }
  if (!error && withGoal) track('observation.goal', { n: Object.values(e.goals!).filter(Boolean).length });
  if (error && audioPath) await supabase.storage.from(BUCKET).remove([audioPath]);
  fail(error);
}

export async function deleteAbc(e: AbcEvent) {
  const { error } = await supabase.from('abc_events').delete().in('id', e.ids);
  fail(error);
  if (e.audioPath) await supabase.storage.from(BUCKET).remove([e.audioPath]);
}
