import AsyncStorage from '@react-native-async-storage/async-storage';

// Uzman davet bağlantısı (ortak/sozlesme/akislar.md 10 adım 4–5b): parentapp://davet/<anahtar> ya da https://<alan adı>/d/<anahtar>.
// Anahtar 32 karakterlik bağlantı anahtarı ya da 6 haneli kod. Kayıt/giriş tamamlanana kadar cihazda saklanır.
const KEY = 'pending-clinic-invite';
const listeners = new Set<(key: string) => void>();

export function parseInviteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:^|[/:])(?:davet|d)\/([0-9a-fA-F]{32}|[A-Za-z0-9]{6})(?:[/?#]|$)/);
  if (!m) return null;
  return m[1].length === 32 ? m[1].toLowerCase() : m[1].toUpperCase();
}

export const isInviteToken = (key: string) => /^[0-9a-f]{32}$/.test(key);

export async function setPendingClinicInvite(key: string) {
  try { await AsyncStorage.setItem(KEY, key); } catch { /* yalnız bu oturumda */ }
  listeners.forEach((fn) => fn(key));
}
export const getPendingClinicInvite = () => AsyncStorage.getItem(KEY).catch(() => null);
export const clearPendingClinicInvite = () => AsyncStorage.removeItem(KEY).catch(() => {});

// Uygulama açıkken gelen bağlantı (giriş yapılmışsa hemen bağlanır)
export function onClinicInvite(fn: (key: string) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
