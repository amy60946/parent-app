import { supabase } from './supabase';
import { Difficulty } from '../theme';

// Uzman (ClinicApp) paylaşımı: sunucu kuralları ortak/supabase/migrations/20261019000000_clinic.sql
// Uzman yalnızca ebeveynin açık rızasıyla, yalnızca o çocuğun görev ve kayıtlarını okur. Posta ve coin paylaşılmaz.

export type ClinicLink = { linkId: string; childId: string; clinic: string; clinician: string; title: string; consentAt: string };
export type InvitePreview = { clinic: string; clinician: string; title: string };
export type Suggestion = {
  id: string; childId: string; title: string; emoji: string; skill: string; difficulty: Difficulty;
  recurring: boolean; note: string; clinic: string;
};
export type AbcInput = { childId: string; antecedent: string; behavior: string; consequence: string; intensity: number };

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export async function listLinks(): Promise<ClinicLink[]> {
  const { data, error } = await supabase.rpc('family_clinic_links');
  fail(error);
  return (data ?? []).map((r: any) => ({
    linkId: r.link_id, childId: r.child_id, clinic: r.clinic, clinician: r.clinician, title: r.title, consentAt: r.consent_at,
  }));
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc('clinic_invite_preview', { p_code: code });
  fail(error);
  return data as InvitePreview;
}

export async function shareWithClinic(code: string, childId: string) {
  const { error } = await supabase.rpc('redeem_clinic_invite', { p_code: code, p_child_id: childId });
  fail(error);
}

export async function stopSharing(linkId: string) {
  const { error } = await supabase.rpc('revoke_clinic_link', { p_link_id: linkId });
  fail(error);
}

export async function pendingSuggestions(familyId: string): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from('clinic_task_suggestions').select('*').eq('family_id', familyId).eq('status', 'pending').order('created_at');
  fail(error);
  const links = await listLinks().catch(() => [] as ClinicLink[]);
  return (data ?? [])
    // Paylaşım durdurulduysa eski öneriler gösterilmez
    .filter((r: any) => links.some((l) => l.linkId === r.link_id))
    .map((r: any) => ({
      id: r.id, childId: r.child_id, title: r.title, emoji: r.emoji, skill: r.skill, difficulty: r.difficulty,
      recurring: r.recurring, note: r.note, clinic: links.find((l) => l.linkId === r.link_id)?.clinician || links.find((l) => l.linkId === r.link_id)?.clinic || 'Uzman',
    }));
}

export async function decideSuggestion(id: string, accepted: boolean) {
  const { error } = await supabase
    .from('clinic_task_suggestions').update({ status: accepted ? 'accepted' : 'declined', decided_at: new Date().toISOString() }).eq('id', id);
  fail(error);
}

export async function addAbcEvent(familyId: string, userId: string | undefined, e: AbcInput) {
  const { error } = await supabase.from('abc_events').insert({
    family_id: familyId, child_id: e.childId, antecedent: e.antecedent.trim(), behavior: e.behavior.trim(),
    consequence: e.consequence.trim(), intensity: e.intensity, created_by: userId ?? null, occurred_at: new Date().toISOString(),
  });
  fail(error);
}
