import { supabase } from './supabase';
import { Difficulty } from '../theme';
import { categorySkill, skillLabels, toCategory } from '../data/templates';

// Uzman (ClinicApp) paylaşımı: sunucu kuralları ortak/supabase/migrations/20261019000000_clinic.sql
// Uzman yalnızca ebeveynin açık rızasıyla, yalnızca o çocuğun görev ve kayıtlarını okur. Posta ve coin paylaşılmaz.

export type ClinicLink = { linkId: string; clinicId: string; childId: string; clinic: string; clinician: string; title: string; consentAt: string };
export type InvitePreview = { clinic: string; clinician: string; title: string };
import type { RepeatKind } from '../store';

// Öneri, ParentApp "Görev Oluştur" ile aynı alanları taşır (ortak/sozlesme/akislar.md 5.4, 3a)
export type Suggestion = {
  id: string; childId: string; title: string; emoji: string; skill: string; difficulty: Difficulty;
  recurring: boolean; note: string; clinic: string;
  description: string; coins?: number; startDate?: string; repeatKind: RepeatKind; repeatDays: number[];
  endDate?: string; reminder?: string; requiresReview: boolean;
};

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export async function listLinks(): Promise<ClinicLink[]> {
  const { data, error } = await supabase.rpc('family_clinic_links');
  fail(error);
  return (data ?? []).map((r: any) => ({
    linkId: r.link_id, clinicId: r.clinic_id, childId: r.child_id, clinic: r.clinic, clinician: r.clinician, title: r.title, consentAt: r.consent_at,
  }));
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc('clinic_invite_preview', { p_code: code });
  fail(error);
  return data as InvitePreview;
}

// Tek kodla seçilen bütün çocuklar (kod tek kullanımlık)
export async function shareWithClinic(code: string, childIds: string[]) {
  const { error } = await supabase.rpc('redeem_clinic_invite_children', { p_code: code, p_child_ids: childIds });
  fail(error);
}

// Aynı uzmanla etkin paylaşım varsa yeni kod gerekmeden başka bir çocuğu da ekle
export async function addChildToClinic(clinicId: string, childId: string) {
  const { error } = await supabase.rpc('clinic_share_child', { p_clinic_id: clinicId, p_child_id: childId });
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
      // Beceri anahtarı; uzman eski serbest metin yazdıysa kategorinin becerisi
      id: r.id, childId: r.child_id, title: r.title, emoji: r.emoji, difficulty: r.difficulty,
      skill: r.skill && r.skill in skillLabels ? r.skill : categorySkill[toCategory(r.category)],
      recurring: r.recurring, note: r.note ?? '', clinic: links.find((l) => l.linkId === r.link_id)?.clinician || links.find((l) => l.linkId === r.link_id)?.clinic || 'Uzman',
      description: r.description ?? '', coins: r.coins ?? undefined, startDate: r.start_date ?? undefined,
      repeatKind: (['daily', 'weekly', 'monthly'].includes(r.repeat_kind) ? r.repeat_kind : 'daily') as RepeatKind,
      repeatDays: (r.repeat_days ?? []).map(Number), endDate: r.end_date ?? undefined, reminder: r.reminder ?? undefined,
      requiresReview: r.requires_review !== false,
    }));
}

// Kabul edilen önerinin hangi göreve dönüştüğü (uzman izler)
export async function linkSuggestionTask(id: string, taskId: string) {
  const { error } = await supabase.from('clinic_task_suggestions').update({ task_id: taskId }).eq('id', id);
  fail(error);
}

export async function decideSuggestion(id: string, accepted: boolean) {
  const { error } = await supabase
    .from('clinic_task_suggestions').update({ status: accepted ? 'accepted' : 'declined', decided_at: new Date().toISOString() }).eq('id', id);
  fail(error);
}
