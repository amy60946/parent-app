import { fromISO } from '../dates';

// Oyundaki yaş grubu (ortak/sozlesme/durumlar.md §4): K 5 ve altı · A 6–8 · B 9–12 · C 13 ve üstü.
// Sınırların tek yeri sunucudaki age_band(doğum günü, gün); burada yalnız gösterim için aynı kural.
// children.age_band yalnız ebeveynin bilerek seçtiği grup; boş (undefined) = otomatik (doğum gününden).
export type AgeBand = 'K' | 'A' | 'B' | 'C';

export const ageBands: { id: AgeBand; label: string }[] = [
  { id: 'K', label: '5 ve altı' },
  { id: 'A', label: '6–8' },
  { id: 'B', label: '9–12' },
  { id: 'C', label: '13 ve üstü' },
];

export const ageBandLabel = (b?: AgeBand) => ageBands.find((x) => x.id === b)?.label ?? '';
export const toAgeBand = (v?: string | null): AgeBand | undefined => (ageBands.some((x) => x.id === v) ? (v as AgeBand) : undefined);

// Doğum gününden grup (sunucudaki age_band ile aynı): <6 K, <9 A, <13 B, aksi C. Doğum günü yoksa A.
// Doğum günü takvim günüdür: yerel gün olarak okunur (fromISO), UTC'ye çevrilmez.
export function suggestAgeBand(birthday?: string, today = new Date()): AgeBand {
  if (!birthday) return 'A';
  const b = fromISO(birthday);
  let age = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--;
  return age < 6 ? 'K' : age < 9 ? 'A' : age < 13 ? 'B' : 'C';
}
