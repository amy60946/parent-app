import { supabase } from './supabase';
import { AppError } from './errors';
import { isMissingRpc } from './clinic';
import { formatTR } from '../dates';

// 30 günlük misafir kartı (ortak proposed/20261028120000_guest_pass.sql; akislar.md 19): aile, ParentApp'i kullanmayan
// bir aileye 30 gün tam erişim hediye eder. Kod 8 karakter (A–Z, 2–9); "Kod gir" kutularından kullanılır.
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
  used: 'Bu hediye kartı daha önce kullanılmış.',
  expired: 'Bu hediye kartının süresi dolmuş.',
  own: 'Kendi ailenin hediye kartını kullanamazsın; bir arkadaşınla paylaş.',
  already: 'Ailen daha önce bir hediye kartı kullandı.',
  premium: 'Zaten Premium üyesin; hediye kartına gerek yok.',
  not_new: 'Hediye kartı yalnız ParentApp\'e yeni başlayan ailelerde (ilk 7 gün) kullanılabilir.',
  too_many_attempts: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.',
};

// Başarılıysa deneme bitiş tarihi; değilse açıklamalı hata (hint = sunucu nedeni)
export async function redeemGuestPass(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_guest_pass', { p_code: code });
  if (error) {
    if (isMissingRpc(error)) throw new AppError('Hediye kartları henüz açık değil.', 'not_found');
    throw new AppError(error.message, error.hint);
  }
  if (data?.ok) return data.trial_ends_at as string;
  const reason = String(data?.error ?? 'not_found');
  throw new AppError(REASONS[reason] ?? data?.message ?? REASONS.not_found, reason);
}

// Kart kullanıldı bildirimi (Kod gir kutuları)
export const guestRedeemedText = (trialEndsAt: string) =>
  `ParentApp ${formatTR(trialEndsAt.slice(0, 10))} tarihine kadar bütün özellikleriyle açık. Kart artık başka bir aile tarafından kullanılamaz.`;
