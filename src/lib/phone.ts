import { supabase } from './supabase';

// Telefon numarası ekleme, iki yönlü doğrulama (kullanıcı isteği 28 Ekim 2026; Joon "Add phone number" örneği):
// Supabase Auth numaraya 6 haneli kod gönderir (phone_change), ebeveyn kodu yazınca numara hesaba (auth.users.phone) yazılır.
// SMS ücretli bir hizmet: Supabase'de SMS sağlayıcısı (Twilio vb.) tanımlanıp bayrak `parent_sms_verify` açılana kadar
// ekran hiç görünmez (ortak/sozlesme/akislar.md 19). Numara uzmana gösterilmez; yeni tablo yok.

export type Country = { code: string; dial: string; name: string };
export const COUNTRIES: Country[] = [
  { code: 'TR', dial: '90', name: 'Türkiye' },
  { code: 'DE', dial: '49', name: 'Almanya' },
  { code: 'NL', dial: '31', name: 'Hollanda' },
  { code: 'BE', dial: '32', name: 'Belçika' },
  { code: 'AT', dial: '43', name: 'Avusturya' },
  { code: 'CH', dial: '41', name: 'İsviçre' },
  { code: 'FR', dial: '33', name: 'Fransa' },
  { code: 'GB', dial: '44', name: 'Birleşik Krallık' },
  { code: 'US', dial: '1', name: 'ABD / Kanada' },
  { code: 'AZ', dial: '994', name: 'Azerbaycan' },
  { code: 'CY', dial: '357', name: 'Kıbrıs' },
  { code: 'SE', dial: '46', name: 'İsveç' },
];

// E.164 (ör. 905321234567): baştaki 0 atılır, yalnız rakam. Türkiye'de 10 hane (5xx…).
export function toE164(dial: string, local: string) {
  const digits = local.replace(/\D/g, '').replace(/^0+/, '');
  return `${dial}${digits}`;
}
export function validLocal(dial: string, local: string) {
  const digits = local.replace(/\D/g, '').replace(/^0+/, '');
  return dial === '90' ? /^5\d{9}$/.test(digits) : digits.length >= 6 && digits.length <= 13;
}

// Sağlayıcı tanımlı değilse Supabase "phone provider" / "sms" hatası verir: açık değil diye ayrı ele alınır
export const smsUnavailable = (e: unknown) => /provider|sms|twilio|messagebird|vonage|textlocal|not enabled|disabled/i.test((e as Error)?.message ?? '');

export async function sendPhoneCode(phone: string) {
  const { error } = await supabase.auth.updateUser({ phone });
  if (error) throw new Error(error.message);
}

export async function verifyPhoneCode(phone: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'Kod hatalı ya da süresi doldu. Yeni kod iste.' : error.message);
}
