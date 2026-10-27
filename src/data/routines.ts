import { Ionicons } from '@expo/vector-icons';
import { templates, Template } from './templates';

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

export const routines: Routine[] = [
  { id: 'morning', title: 'Güne hazır sabah', subtitle: 'Okul sabahları', icon: 'sunny-outline', tint: '#FFF1D6', repeat: 'weekdays', items: [
    { key: 'gs_focus_039', time: '07:00' }, // Odanın perdesini aç
    { key: 'gs_focus_057', time: '07:05' }, // Yatağını topla
    { key: 'gs_health_033', time: '07:15' }, // Sabah dişlerini fırçala
    { key: 'gs_focus_044', time: '07:20' }, // Okula giyinerek hazırlan
    { key: 'gs_health_031', time: '07:30' }, // Kahvaltını yap
    { key: 'gs_focus_043', time: '07:45' }, // Okul çantanı hazırla
  ] },
  { id: 'afterschool', title: 'Okul dönüşü', subtitle: 'Öğleden sonra', icon: 'school-outline', tint: '#E3F0FF', repeat: 'weekdays', items: [
    { key: 'gs_home_008', time: '15:30' }, // Ayakkabılarını yerine koy
    { key: 'gs_focus_032', time: '15:45' }, // Kendine bir atıştırmalık hazırla
    { key: 'gs_focus_061', time: '16:00' }, // Ödeve başlamadan malzemeni hazırla
    { key: 'gs_learn_013', time: '16:15' }, // Bir ödevini yap
    { key: 'gs_health_026', time: '17:30' }, // Dışarıda oyna
  ] },
  { id: 'evening', title: 'Sakin akşam', subtitle: 'Uyku öncesi', icon: 'moon-outline', tint: '#ECE8FF', repeat: 'daily', items: [
    { key: 'gs_home_050', time: '19:00' }, // Sofrayı kurmaya yardım et
    { key: 'gs_home_033', time: '19:40' }, // Tabağını lavaboya bırak
    { key: 'gs_focus_056', time: '20:00' }, // Yarının kıyafetlerini seç
    { key: 'gs_focus_058', time: '20:10' }, // Ekranları kapat
    { key: 'gs_health_040', time: '20:20' }, // Yatmadan önce dişlerini fırçala
    { key: 'gs_learn_033', time: '20:30' }, // Yatmadan önce kitap oku
  ] },
  { id: 'chores', title: 'Haftalık ev işleri', subtitle: 'Her gün bir iş', icon: 'home-outline', tint: '#E6F4EA', repeat: 'weekly', items: [
    { key: 'gs_home_045', time: '18:00', days: [1] }, // Odanı topla
    { key: 'gs_home_062', time: '18:00', days: [2] }, // Çamaşırları ayırmaya yardım et
    { key: 'gs_home_063', time: '18:00', days: [3] }, // Çiçekleri sula
    { key: 'gs_home_055', time: '18:00', days: [4] }, // Temiz çamaşırları yerleştir
    { key: 'gs_home_012', time: '18:00', days: [5] }, // Banyo çöp kutusunu boşalt
  ] },
  { id: 'family', title: 'Ailece bir hafta', subtitle: 'Her akşam birlikte', icon: 'people-outline', tint: '#FDE7EF', repeat: 'weekly', items: [
    { key: 'gs_relation_009', time: '19:30', days: [1] }, // Ailenle kutu oyunu oyna
    { key: 'gs_relation_010', time: '18:30', days: [2] }, // Ailenle yürüyüşe çık
    { key: 'gs_focus_005', time: '18:00', days: [3] }, // Aile için bir yemek hazırla
    { key: 'gs_mind_015', time: '20:00', days: [4] }, // Duygularını annen ya da babanla konuş
    { key: 'gs_relation_002', time: '20:00', days: [5] }, // Ailece film gecesi yap
  ] },
  { id: 'weekend', title: 'Hafta sonu keyfi', subtitle: 'Cumartesi ve Pazar', icon: 'bicycle-outline', tint: '#E0F5F3', repeat: 'weekly', items: [
    { key: 'gs_focus_029', time: '09:30', days: [6, 7] }, // Kalkınca odanı topla
    { key: 'gs_health_022', time: '11:00', days: [6, 7] }, // Bisiklet sür
    { key: 'gs_learn_006', time: '15:00', days: [6, 7] }, // 20 dakika kitap oku
    { key: 'gs_relation_008', time: '19:00', days: [6, 7] }, // Ailenle kart oyunu oyna
  ] },
];

// Katalogda olmayan anahtar (katalog değişirse) sessizce atlanır
export function routineTasks(r: Routine): RoutineTask[] {
  return r.items.flatMap((i) => {
    const t = templates.find((x) => x.id === i.key);
    return t ? [{ ...t, time: i.time, days: i.days }] : [];
  });
}

export const routineById = (id: string) => routines.find((r) => r.id === id);
