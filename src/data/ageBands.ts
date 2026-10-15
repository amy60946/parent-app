import { fromISO } from '../dates';

// Pofi Adası oyunundaki yaş bandı: oyunun dili, zorluğu ve görünümü buna göre ayarlanır.
export type AgeBand = 'A' | 'B' | 'C';

export const ageBands: { id: AgeBand; label: string }[] = [
  { id: 'A', label: '6–9 yaş' },
  { id: 'B', label: '10–12 yaş' },
  { id: 'C', label: '13–15 yaş' },
];

export const ageBandLabel = (b?: AgeBand) => ageBands.find((x) => x.id === b)?.label ?? '';

// Doğum gününden öneri (sunucudaki suggest_age_band ile aynı): <10 → A, 10–12 → B, 13+ → C. Doğum günü yoksa A.
export function suggestAgeBand(birthday?: string, today = new Date()): AgeBand {
  if (!birthday) return 'A';
  const b = fromISO(birthday);
  let age = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--;
  return age < 10 ? 'A' : age < 13 ? 'B' : 'C';
}
