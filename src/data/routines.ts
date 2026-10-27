import { Ionicons } from '@expo/vector-icons';
import { templates, Template } from './templates';
import routinesJson from './routines.json';

// Hazır rutinler (kullanıcı isteği 27 Ekim 2026; Joon "daily routine" örnekleri, kopya değil): birkaç görevi tek seferde ekleyen
// şablon setleri. Görevler katalogdan (taskCatalog.json) alınır; başlık, saat ve kimin için eklenmeden önce düzenlenir.
// Her görev ayrı kaydedilir (sunucuda "rutin" diye ayrı kayıt yok): sonra Görevler'den tek tek düzenlenir ya da silinir.
// repeat: 'weekdays' = hafta içi (Pzt–Cum), 'daily' = her gün, 'weekly' = her görevin kendi günü (days, 1 = Pzt … 7 = Paz).
export type RoutineRepeat = 'weekdays' | 'daily' | 'weekly';
type Item = { key: string; time: string; days?: number[] };
export type Routine = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  repeat: RoutineRepeat;
  items: Item[];
};
export type RoutineTask = Template & { time: string; days?: number[] };

export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKEND = [6, 7];

// Tek kaynak: ortak/veri/hazir_rutinler.json (ClinicApp "Günlük rutin önerisi" de bunu kullanır). Buradaki kopya:
// bash tools/sync_routines.sh ../ortak/veri/hazir_rutinler.json — rutin değişince önce ortakta değiştir, sonra eşitle.
export const routines: Routine[] = (routinesJson as { routines: Routine[] }).routines;

// Katalogda olmayan anahtar (katalog değişirse) sessizce atlanır
export function routineTasks(r: Routine): RoutineTask[] {
  return r.items.flatMap((i) => {
    const t = templates.find((x) => x.id === i.key);
    return t ? [{ ...t, time: i.time, days: i.days }] : [];
  });
}

export const routineById = (id: string) => routines.find((r) => r.id === id);
