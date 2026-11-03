import { supabase } from './supabase';
import { AppError } from './errors';
import { isMissingRpc } from './clinic';
import { formatTR } from '../dates';

// Aile davet et (ortak proposed/20261028120000_guest_pass.sql; akislar.md 19; kullanıcı kararı 3 Kasım 2026): aile, ParentApp'i
// kullanmayan bir aileye davet kodu gönderir; o aile 7 + 7 = 14 gün dener. Davet edilen aile mağazadan abone olunca davet eden
// 1 ay kazanır (yılda en çok 12). Kod 8 karakter (A–Z, 2–9); "Kod gir" kutularından kullanılır.
export const GUEST_CODE = /^[A-Z2-9]{8}$/;

export type GuestPass = { code: string; expiresAt: string };

// Sunucuda işlev yoksa (öneri uygulanmadı) null: ekran "yakında" der
export async function createGuestPass(): Promise<GuestPass | null> {
  const { data, error } = await supabase.rpc('create_guest_pass');
  if (error) { if (isMissingRpc(error)) return null; throw new AppError(error.message, error.hint); }
  return { code: data.code, expiresAt: data.expires_at };
}

const REASONS: Record<string, string> = {
  not_found: 'Kod bulunamadı. Harfleri kontrol et.',
  used: 'Bu davet kodu daha önce kullanılmış.',
  expired: 'Bu davet kodunun süresi dolmuş.',
  own: 'Kendi davet kodunu kullanamazsın; bir aileyle paylaş.',
  already: 'Ailen daha önce bir davet kodu kullandı.',
  premium: 'Zaten Premium üyesin; davet koduna gerek yok.',
  not_new: 'Davet kodu yalnız ParentApp\'e yeni başlayan ailelerde (ilk 7 gün) kullanılabilir.',
  too_many_attempts: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.',
};

// Başarılıysa deneme bitiş tarihi; değilse açıklamalı hata (hint = sunucu nedeni)
export async function redeemGuestPass(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_guest_pass', { p_code: code });
  if (error) {
    if (isMissingRpc(error)) throw new AppError('Davet kodları henüz açık değil.', 'not_found');
    throw new AppError(error.message, error.hint);
  }
  if (data?.ok) return data.trial_ends_at as string;
  const reason = String(data?.error ?? 'not_found');
  throw new AppError(REASONS[reason] ?? data?.message ?? REASONS.not_found, reason);
}

// Kod kullanıldı bildirimi (Kod gir kutuları)
export const guestRedeemedText = (trialEndsAt: string) =>
  `ParentApp ${formatTR(trialEndsAt.slice(0, 10))} tarihine kadar bütün özellikleriyle açık (7 yerine 14 gün). Kod artık başka bir aile tarafından kullanılamaz.`;

// Davet özeti (kimlik yok): katılan aile, abone olan, kazanılan ay, yıllık kalan hak, Apple hediye kodları
export type Referrals = { joined: number; paid: number; months: number; yearLeft: number; pendingCodes: number; codes: { code: string; sentAt: string }[] };
export async function myReferrals(): Promise<Referrals | null> {
  const { data, error } = await supabase.rpc('my_referrals');
  if (error || !data) return null; // öneri uygulanmadıysa özet gösterilmez
  return {
    joined: data.joined ?? 0, paid: data.paid ?? 0, months: data.months ?? 0, yearLeft: data.year_left ?? 12,
    pendingCodes: data.pending_codes ?? 0, codes: (data.codes ?? []).map((c: any) => ({ code: c.code, sentAt: c.sent_at })),
  };
}
