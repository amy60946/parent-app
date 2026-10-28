import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { routines } from '../data/routines';
import { TemplateAge } from '../data/templates';
import { suggestAgeBand } from '../data/ageBands';
import type { Child } from '../store';

// Ailene özel plan (kurulumdaki tanışma yanıtlarından; kullanıcı isteği 28 Ekim 2026): hedeflere uyan hazır rutinler öne çıkar,
// görev önerileri çocukların yaş grubuna göre süzülür. Yanıt yoksa sıra ve süzgeç bugünkü gibi kalır. Sağlık yanıtları kullanılmaz.
// Anahtarlar ortak/sozlesme/durumlar.md P16.
const GOAL_ROUTINES: Record<string, string[]> = {
  motivation: ['morning', 'afterschool', 'chores'],
  structure: ['morning', 'evening', 'afterschool'],
  behavior: ['evening', 'family'],
  executive: ['afterschool', 'morning'],
  relationship: ['family', 'weekend'],
  my_stress: ['chores', 'evening'],
};
const CHILD_GOAL_ROUTINES: Record<string, string[]> = {
  chores: ['chores'], focus: ['afterschool'], impulses: ['evening'], bedtime: ['evening'], siblings: ['family'], emotions: ['evening', 'family'],
};
const KEYS = ['main_goal', 'other_goals', 'child_goals', 'child_routine'];

type Row = { question_key: string; answer: string[] };
let cache: Promise<Row[]> | null = null;
const load = () => (cache ??= Promise.resolve(supabase.from('intake_answers').select('question_key, answer').in('question_key', KEYS))
  .then(({ data, error }) => (error ? [] : ((data ?? []) as Row[])))
  .catch(() => [] as Row[]));
export const resetPlan = () => { cache = null; }; // kurulum bitince yeniden okunur

export function routineScores(rows: Row[]): Record<string, number> {
  const s: Record<string, number> = {};
  const add = (ids: string[] | undefined, w: number) => ids?.forEach((id, i) => { s[id] = (s[id] ?? 0) + Math.max(w - i * 0.5, 0.5); });
  for (const r of rows) {
    for (const v of r.answer ?? []) {
      if (r.question_key === 'main_goal') add(GOAL_ROUTINES[v], 3);
      else if (r.question_key === 'other_goals') add(GOAL_ROUTINES[v], 1);
      else if (r.question_key === 'child_goals') add(CHILD_GOAL_ROUTINES[v], 1);
      else if (r.question_key === 'child_routine' && v !== 'yes') add(['morning', 'evening'], 1);
    }
  }
  return s;
}

// Bütün çocuklar aynı yaş grubundaysa o grup; değilse süzgeç yok
export function familyAge(children: Pick<Child, 'ageBand' | 'birthday'>[]): TemplateAge | 'all' {
  const bands = new Set(children.map((c) => c.ageBand ?? suggestAgeBand(c.birthday)));
  return bands.size === 1 ? ([...bands][0] as TemplateAge) : 'all';
}

export function usePlan() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { let live = true; load().then((r) => { if (live) setRows(r); }); return () => { live = false; }; }, []);
  return useMemo(() => {
    const scores = routineScores(rows ?? []);
    const ordered = [...routines].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0)); // eşitlikte katalog sırası (sort kararlı)
    const top = ordered[0] && (scores[ordered[0].id] ?? 0) > 0 ? ordered[0].id : undefined;
    return { routines: ordered, recommended: top, ready: rows !== null };
  }, [rows]);
}
