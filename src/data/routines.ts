import { Ionicons } from '@expo/vector-icons';
import { templates, Template, TemplateAge } from './templates';
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
  // Katalog sürüm 2 (ortak akislar.md 5.4 v2): aynı konunun (theme) yaş gruplarına göre sürümleri; ages = uygun gruplar
  theme?: string;
  ages?: TemplateAge[];
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

// Konu başına tek rutin: çocuğun yaş grubuna uyan sürüm. Yaş bilinmiyorsa ('all') konunun varsayılan sürümü (kimliği konuyla
// aynı olan; eski kimlikler korunur), yoksa ilki. Sıra katalog sırası.
export const themeOf = (r: Routine) => r.theme ?? r.id;
export function routinesForAge(age: TemplateAge | 'all'): Routine[] {
  const out: Routine[] = [];
  for (const theme of [...new Set(routines.map(themeOf))]) {
    const all = routines.filter((r) => themeOf(r) === theme);
    const pick = (age !== 'all' && all.find((r) => !r.ages || r.ages.includes(age))) || all.find((r) => r.id === theme) || all[0];
    if (pick) out.push(pick);
  }
  return out;
}
