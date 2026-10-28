import { supabase } from './supabase';
import { AppError } from './errors';
import { Difficulty } from '../theme';
import { categorySkill, skillLabels, toCategory } from '../data/templates';

// Uzman (ClinicApp) paylaşımı: sunucu kuralları ortak/supabase/migrations/20261019000000_clinic.sql
// Uzman yalnızca ebeveynin açık rızasıyla, yalnızca o çocuğun görev ve kayıtlarını okur. Posta ve coin paylaşılmaz.

export type ClinicLink = {
  linkId: string; clinicId: string; childId: string; clinic: string; clinician: string; title: string; consentAt: string;
  // uzman değişimi (akislar.md 11): önceki uzman kayıtları bu uzmana açık mı / açılabilecek kayıt var mı; belge rozeti (14)
  historyShared: boolean; historyAvailable: boolean; verifiedAs?: string;
  planReady: boolean; // sunucuda takip planı var (yeni sürüm); eski sunucuda Takip planı satırı gösterilmez
};
import type { RepeatKind } from '../store';

// Öneri, ParentApp "Görev Oluştur" ile aynı alanları taşır (ortak/sozlesme/akislar.md 5.4, 3a)
export type Suggestion = {
  id: string; linkId: string; childId: string; title: string; emoji: string; skill: string; difficulty: Difficulty;
  recurring: boolean; note: string; clinic: string;
  description: string; coins?: number; startDate?: string; repeatKind: RepeatKind; repeatDays: number[];
  endDate?: string; reminder?: string; requiresReview: boolean;
  // Günlük rutin v2 (öneri 20261028200000_routines_v2): aynı routineGroup'lu öneriler tek paket; goalId takip planı hedefi.
  // Sütunlar sunucuda yoksa (select *) boş gelir: öneri tek başına gösterilir.
  routine?: { group: string; title: string; icon?: string; position: number }; goalId?: string;
};

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

// Sunucuda henüz olmayan işlev (öneri uygulanmadı): çağıran eski akışa sessizce düşer
export const isMissingRpc = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null;
  return !!x && (x.code === 'PGRST202' || x.code === '42883' || /could not find the function/i.test(x.message ?? ''));
};

export async function listLinks(): Promise<ClinicLink[]> {
  const { data, error } = await supabase.rpc('family_clinic_links');
  fail(error);
  return (data ?? []).map((r: any) => ({
    linkId: r.link_id, clinicId: r.clinic_id, childId: r.child_id, clinic: r.clinic, clinician: r.clinician, title: r.title, consentAt: r.consent_at,
    historyShared: !!r.history_shared, historyAvailable: !!r.history_available, verifiedAs: r.verified_as ?? undefined,
    planReady: 'history_available' in r,
  }));
}

// Aynı uzmanla etkin paylaşım varsa yeni kod gerekmeden başka bir çocuğu da ekle
// Onay metninin sürümü kaydedilir (20261026300000); eski sunucuda 3 argümanlı işlev yoksa 2 argümanla
export async function addChildToClinic(clinicId: string, childId: string) {
  const r = await supabase.rpc('clinic_share_child', { p_clinic_id: clinicId, p_child_id: childId, p_consent_version: 'uzman-paylasim-v1' });
  if (r.error && isMissingRpc(r.error)) {
    const { error } = await supabase.rpc('clinic_share_child', { p_clinic_id: clinicId, p_child_id: childId });
    return fail(error);
  }
  fail(r.error);
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
      id: r.id, linkId: r.link_id, childId: r.child_id, title: r.title, emoji: r.emoji, difficulty: r.difficulty,
      skill: r.skill && r.skill in skillLabels ? r.skill : categorySkill[toCategory(r.category)],
      recurring: r.recurring, note: r.note ?? '', clinic: links.find((l) => l.linkId === r.link_id)?.clinician || links.find((l) => l.linkId === r.link_id)?.clinic || 'Uzman',
      description: r.description ?? '', coins: r.coins ?? undefined, startDate: r.start_date ?? undefined,
      repeatKind: (['daily', 'weekly', 'monthly'].includes(r.repeat_kind) ? r.repeat_kind : 'daily') as RepeatKind,
      repeatDays: (r.repeat_days ?? []).map(Number), endDate: r.end_date ?? undefined, reminder: r.reminder ?? undefined,
      requiresReview: r.requires_review !== false,
      routine: r.routine_group ? { group: r.routine_group, title: r.routine_title ?? 'Rutin', icon: r.routine_icon ?? undefined, position: Number(r.routine_position ?? 0) } : undefined,
      goalId: r.goal_id ?? undefined,
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

/* ---------- Uzman daveti (ortak/sozlesme/akislar.md 10–14; öneri 20261026100000_family_invite_links.sql) ---------- */

// Onay metinlerinin sürümleri: metin değişirse sürüm de değişir (hukuk_notlari.md 3B, 3F)
export const SHARE_CONSENT = 'uzman-paylasim-v1';
export const HISTORY_CONSENT = 'uzman-gecis-v1';

export type InviteAgeGroup = 'K' | 'A' | 'B' | 'C';
export type PendingInvite = {
  code: string; clinic: string; clinician: string; title: string;
  childName?: string; childAgeGroup?: InviteAgeGroup; hasPlan: boolean; verifiedAs?: string;
};

const toInvite = (r: any): PendingInvite => ({
  code: r.code, clinic: r.clinic ?? '', clinician: r.clinician ?? '', title: r.title ?? '',
  childName: r.child_name ?? undefined, childAgeGroup: ['K', 'A', 'B', 'C'].includes(r.child_age_group) ? r.child_age_group : undefined,
  hasPlan: !!r.has_plan, verifiedAs: r.verified_as ?? undefined,
});

// Davet artık kullanılamaz (sunucu reason → hint; 20261026300000 ile accepted / declined / revoked da gelir): bekleyen bağlantı silinir
export const INVITE_FINAL = ['expired', 'used', 'not_found', 'accepted', 'declined', 'revoked'];
export const inviteErrorTitle = (hint?: string) => (hint === 'accepted' ? 'Bu daveti zaten kabul ettin' : 'Davet kullanılamadı');

// Davet hatası: sunucu nedeni (reason → hint) ve açık metni taşır
function inviteError(e: { message: string; hint?: string | null }) {
  return new AppError(e.message || 'Davet bulunamadı. Kodu kontrol et ya da uzmanından yeni davet iste.', e.hint);
}

// Ailenin bağlı ama henüz çocuk paylaşılmamış davetleri. Eski sunucuda boş liste.
export async function pendingInvites(): Promise<PendingInvite[]> {
  const { data, error } = await supabase.rpc('family_pending_invites');
  if (error) { if (isMissingRpc(error)) return []; throw new Error(error.message); }
  return (data ?? []).map(toInvite);
}

// Bağlantı anahtarı (32) ya da 6 haneli kodla daveti bu aileye bağla. Eski sunucuda null (çağıran eski kod akışına düşer).
export async function claimInvite(key: string): Promise<PendingInvite | null> {
  const { data, error } = await supabase.rpc('claim_clinic_invite', { p_key: key });
  if (error) { if (isMissingRpc(error)) return null; throw inviteError(error); }
  if (data?.error) throw inviteError({ message: data.message, hint: data.reason ?? data.hint });
  return toInvite(data);
}

// Bağlantı/kod: daveti bağla, hâlâ bekliyorsa davet ekranı için döndür. Sunucu aynı ailenin daha önce kabul ettiği daveti de
// başarıyla bağlar (bekleyen listede yer almaz): o zaman 'done' — ekran yeniden açılmaz, ebeveyne Uzmanım gösterilir.
export async function openInvite(key: string): Promise<{ kind: 'old' } | { kind: 'pending' | 'done'; invite: PendingInvite }> {
  const invite = await claimInvite(key);
  if (!invite) return { kind: 'old' };
  const pending = (await pendingInvites()).find((i) => i.code === invite.code);
  return pending ? { kind: 'pending', invite: pending } : { kind: 'done', invite };
}

export type NewChild = {
  name: string; age_group?: InviteAgeGroup; birthday?: string; gender?: 'kız' | 'erkek'; avatar?: string; allow_duplicate?: boolean;
};
export type AcceptResult =
  | { ok: true; linkIds: string[]; childIds: string[] }
  | { ok: false; duplicate: { childId: string; name: string; message: string } };

// "Onayla ve paylaş": önerilen çocuk sunucuda oluşur + seçilen çocuklarla paylaşılır (tek çağrı)
export async function acceptInvite(key: string, child: NewChild | null, childIds: string[], shareHistory: boolean): Promise<AcceptResult> {
  const { data, error } = await supabase.rpc('family_accept_invite', {
    p_key: key, p_child: child, p_child_ids: childIds.length ? childIds : null, p_share_history: shareHistory,
    p_consent_version: SHARE_CONSENT, p_history_version: shareHistory ? HISTORY_CONSENT : null,
  });
  if (error) throw inviteError(error);
  if (data?.error === 'duplicate_child') {
    return { ok: false, duplicate: { childId: data.child_id, name: data.name, message: data.message } };
  }
  if (data?.error) throw inviteError({ message: data.message, hint: data.reason ?? data.hint });
  return { ok: true, linkIds: data?.link_ids ?? [], childIds: data?.child_ids ?? [] };
}

export async function declineInvite(key: string) {
  const { error } = await supabase.rpc('family_decline_invite', { p_key: key });
  fail(error);
}

// Önceki uzman kayıtlarının bu uzmana aktarımı (geri alınabilir rıza)
export async function setHistoryShared(linkId: string, on: boolean) {
  const { error } = await supabase.rpc('clinic_link_history_set', { p_link_id: linkId, p_on: on, p_consent_version: on ? HISTORY_CONSENT : null });
  fail(error);
}

// Kayıttan önce (oturum yok) davet bilgisi: Edge Function invite-info (herkese açık, yalnız bağlantı anahtarıyla)
export type InviteInfo = { status: 'open' | 'used' | 'expired' | 'revoked' | 'not_found' | 'error'; clinic?: string; clinician?: string; title?: string; code?: string; verifiedAs?: string };
export async function inviteInfo(token: string): Promise<InviteInfo | null> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !/^[0-9a-f]{32}$/i.test(token)) return null;
  try {
    const r = await fetch(`${url}/functions/v1/invite-info?t=${token.toLowerCase()}`, { headers: key ? { apikey: key } : {} });
    if (!r.ok) return null;
    const j = await r.json();
    return { status: j.status, clinic: j.clinic, clinician: j.clinician, title: j.title, code: j.code, verifiedAs: j.verified_as ?? undefined };
  } catch {
    return null;
  }
}

/* ---------- Takip planı (akislar.md 12) ---------- */

export type CareGoal = { id: string; title: string; description: string; homeSupport: string; target: string; status: 'active' | 'achieved' | 'paused' };
export type CareModule = { id: string; title: string; aim: string; practice: string; checklist: string[]; status: 'active' | 'done'; practicedWeek: number };
export type CareBarrier = 'no_time' | 'forgot' | 'child_resisted' | 'unsure';
export type CareLog = { moduleId: string; practiced: boolean; difficulty?: number; barrier?: CareBarrier };

export async function carePlan(linkId: string): Promise<{ goals: CareGoal[]; modules: CareModule[] } | null> {
  const { data, error } = await supabase.rpc('family_care_plan', { p_link_id: linkId });
  if (error) { if (isMissingRpc(error)) return null; throw new Error(error.message); }
  if (!data) return { goals: [], modules: [] };
  return {
    goals: (data.goals ?? []).map((g: any) => ({
      id: g.id, title: g.title, description: g.description ?? '', homeSupport: g.home_support ?? '', target: g.target ?? '', status: g.status,
    })),
    modules: (data.modules ?? []).map((m: any) => ({
      id: m.id, title: m.title, aim: m.aim ?? '', practice: m.practice ?? '',
      checklist: (Array.isArray(m.checklist) ? m.checklist : []).map((x: any) => (typeof x === 'string' ? x : x?.text ?? '')).filter(Boolean),
      status: m.status, practicedWeek: Number(m.practiced_week ?? 0),
    })),
  };
}

// Bugünkü kayıtlar (ebeveyn kendi kayıtlarını görür; RLS)
export async function todayLogs(moduleIds: string[], day: string): Promise<CareLog[]> {
  if (!moduleIds.length) return [];
  const { data, error } = await supabase.from('care_module_logs')
    .select('module_id, practiced, difficulty, barrier').in('module_id', moduleIds).eq('day', day);
  fail(error);
  return (data ?? []).map((r: any) => ({ moduleId: r.module_id, practiced: r.practiced, difficulty: r.difficulty ?? undefined, barrier: r.barrier ?? undefined }));
}

// Günde tek kayıt (modül + ebeveyn + gün): ikinci dokunuş aynı kaydı günceller. Aile kimliğini sunucu doldurur.
export async function saveLog(userId: string, day: string, log: CareLog) {
  const { error } = await supabase.from('care_module_logs').upsert({
    module_id: log.moduleId, created_by: userId, day, practiced: log.practiced,
    difficulty: log.practiced ? log.difficulty ?? null : null, barrier: log.practiced ? null : log.barrier ?? null,
  }, { onConflict: 'module_id,created_by,day' });
  fail(error);
}
