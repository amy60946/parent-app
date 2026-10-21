// Gün bölümleri (ortak/sozlesme/durumlar.md 9). Görevde gece yok; zor anda var.
export type DayPart = 'morning' | 'noon' | 'evening' | 'night';
export type TaskDayPart = Exclude<DayPart, 'night'>;

export const dayPartLabel: Record<DayPart, string> = { morning: 'Sabah', noon: 'Öğlen', evening: 'Akşam', night: 'Gece' };

// Saatten bölüm: sabah 05–11, öğle 11–16, akşam 16–21, gece 21–05
export function dayPartOf(hhmm: string): DayPart {
  const h = Number(hhmm.split(':')[0]);
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'noon';
  if (h >= 16 && h < 21) return 'evening';
  return 'night';
}

// Görev için: gece saatleri akşama sayılır
export const taskDayPartOf = (hhmm: string): TaskDayPart => {
  const p = dayPartOf(hhmm);
  return p === 'night' ? 'evening' : p;
};

// Zor an kaydında occurred_at için temsil saati
export const dayPartHour: Record<DayPart, number> = { morning: 8, noon: 13, evening: 19, night: 22 };
