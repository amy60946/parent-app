import { supabase } from './supabase';
import { HEALTH_CONSENT, INTAKE_VERSION } from '../data/intake';

// Tanışma yanıtları (ortak/sozlesme/veritabani.md 16): kişi + çocuk + soru başına tek satır; aile/kişi kimliği sunucudan.
export async function saveAnswer(childId: string | null, key: string, values: string[], health = false) {
  const consent = health && !(values.length === 1 && values[0] === 'prefer_not') ? HEALTH_CONSENT : null;
  const { error } = await supabase.from('intake_answers').upsert(
    { child_id: childId, question_key: key, answer: values, version: INTAKE_VERSION, consent_version: consent },
    { onConflict: 'user_id,child_id,question_key' },
  );
  if (error) throw new Error(error.message);
}

// Kendi yanıtlarım (geri dönüşte seçili göstermek için)
export async function myAnswers(userId: string, childId: string | null): Promise<Record<string, string[]>> {
  let q = supabase.from('intake_answers').select('question_key, answer').eq('user_id', userId);
  q = childId ? q.eq('child_id', childId) : q.is('child_id', null);
  const { data, error } = await q;
  if (error) return {};
  return Object.fromEntries((data ?? []).map((r: any) => [r.question_key, r.answer as string[]]));
}

// İlk kurulum bitti mi? Sunucuda alan yoksa (öneri uygulanmadı) bitmiş sayılır: bugünkü akış sürer.
export async function setupDone(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('setup_completed_at').eq('id', userId).maybeSingle();
  if (error || !data) return true;
  return !!(data as any).setup_completed_at;
}

export async function completeSetup() {
  const { error } = await supabase.rpc('parent_setup_complete');
  if (error) throw new Error(error.message);
}
