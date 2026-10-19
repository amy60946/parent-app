import { fromISO } from '../dates';

// Pofi Adası oyunundaki yaş bandı: oyunun dili, zorluğu ve görünümü buna göre ayarlanır.
// İki bant (ortak/sozlesme/durumlar.md 4, 19 Ekim 2026 kararı).
export type AgeBand = 'A' | 'B';

export const ageBands: { id: AgeBand; label: string }[] = [
  { id: 'A', label: '6–8 yaş' },
  { id: 'B', label: '9–12 yaş' },
];

export const ageBandLabel = (b?: AgeBand) => ageBands.find((x) => x.id === b)?.label ?? '';

// Doğum gününden öneri (sunucudaki suggest_age_band ile aynı): <9 → A, 9+ → B. Doğum günü yoksa A.
export function suggestAgeBand(birthday?: string, today = new Date()): AgeBand {
  if (!birthday) return 'A';
  const b = fromISO(birthday);
  let age = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--;
  return age < 9 ? 'A' : 'B';
}
