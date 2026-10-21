import { Difficulty } from '../theme';

// 6 ana kategori (ortak/sozlesme/durumlar.md 9). Eski 'self' kayıtları sunucuda 'health' oldu.
export type Category = 'home' | 'mind' | 'learn' | 'health' | 'focus' | 'relation';

export const categories: { id: Category; label: string; emoji: string }[] = [
  { id: 'home', label: 'Ev İşleri', emoji: '🏠' },
  { id: 'mind', label: 'Ruh Sağlığı', emoji: '🌈' },
  { id: 'learn', label: 'Öğrenme ve Eğitim', emoji: '📚' },
  { id: 'health', label: 'Sağlık ve Spor', emoji: '💪' },
  { id: 'focus', label: 'Odak ve Öz Denetim', emoji: '🎯' },
  { id: 'relation', label: 'İlişki Kurma', emoji: '🤝' },
];

export const toCategory = (c?: string | null): Category =>
  c === 'self' ? 'health' : categories.some((x) => x.id === c) ? (c as Category) : 'home';

export type Template = {
  id: string;
  title: string;
  emoji: string;
  category: Category;
  difficulty: Difficulty;
  skill: string; // hangi beceriye hitap ediyor
  usedBy: number; // kaç ebeveyn kullandı
  ages?: TemplateAge[]; // uygun yaş grupları; yoksa hepsi
  custom?: boolean;
};

// Şablon süzgecinin yaş grupları (yalnız ParentApp'te; oyunun yaş bandı ayrıdır: ageBands.ts)
export type TemplateAge = 'U' | 'A' | 'B' | 'T';
export const templateAges: { id: TemplateAge; label: string }[] = [
  { id: 'U', label: '6 ve altı' },
  { id: 'A', label: '6–8' },
  { id: 'B', label: '9–12' },
  { id: 'T', label: '12 ve üzeri' },
];

const ALL: TemplateAge[] = ['U', 'A', 'B', 'T'];
const AB: TemplateAge[] = ['A', 'B', 'T']; // okul çağı ve üstü
const A: TemplateAge[] = ['U', 'A'];
const B: TemplateAge[] = ['B', 'T'];

export const templates: Template[] = [
  // Ev İşleri
  { id: 't1', title: 'Yatağını topla', emoji: '🛏️', category: 'home', difficulty: 'easy', skill: 'Takım Çalışması', usedBy: 843, ages: AB },
  { id: 't2', title: 'Oyuncaklarını topla', emoji: '🧸', category: 'home', difficulty: 'easy', skill: 'Takım Çalışması', usedBy: 659, ages: A },
  { id: 't3', title: 'Sofrayı kurmaya yardım et', emoji: '🍽️', category: 'home', difficulty: 'medium', skill: 'Takım Çalışması', usedBy: 477, ages: AB },
  { id: 't4', title: 'Kirli çamaşırları sepete at', emoji: '🧺', category: 'home', difficulty: 'easy', skill: 'Takım Çalışması', usedBy: 296, ages: A },
  { id: 't5', title: 'Odanı süpür', emoji: '🧹', category: 'home', difficulty: 'medium', skill: 'Takım Çalışması', usedBy: 1015, ages: B },
  { id: 't6', title: 'Bulaşık makinesini boşalt', emoji: '🫧', category: 'home', difficulty: 'hard', skill: 'Takım Çalışması', usedBy: 834, ages: B },
  { id: 't7', title: 'Çiçekleri sula', emoji: '🪴', category: 'home', difficulty: 'easy', skill: 'Sorumluluk', usedBy: 653, ages: ALL },
  { id: 't15', title: 'Çamaşırlarını katla', emoji: '👚', category: 'home', difficulty: 'medium', skill: 'Sorumluluk', usedBy: 388, ages: B },
  // Ruh Sağlığı
  { id: 't12', title: 'Derin nefes egzersizi yap', emoji: '🌬️', category: 'mind', difficulty: 'easy', skill: 'Sakinleşme', usedBy: 231, ages: ALL },
  { id: 't13', title: 'Bugün güzel olan 3 şeyi anlat', emoji: '🌈', category: 'mind', difficulty: 'medium', skill: 'Minnettarlık', usedBy: 188, ages: AB },
  { id: 't16', title: 'Duygunu bir resimle çiz', emoji: '🖍️', category: 'mind', difficulty: 'easy', skill: 'Duygu Farkındalığı', usedBy: 164, ages: A },
  { id: 't17', title: 'Günlüğüne 3 cümle yaz', emoji: '📓', category: 'mind', difficulty: 'medium', skill: 'Duygu Farkındalığı', usedBy: 142, ages: B },
  // Öğrenme ve Eğitim
  { id: 't10', title: '10 dakika kitap oku', emoji: '📖', category: 'learn', difficulty: 'medium', skill: 'Okuma', usedBy: 902, ages: AB },
  { id: 't11', title: 'Ödevini bitir', emoji: '✏️', category: 'learn', difficulty: 'hard', skill: 'Sorumluluk', usedBy: 768, ages: AB },
  { id: 't18', title: 'Harfleri / sayıları çalış', emoji: '🔤', category: 'learn', difficulty: 'easy', skill: 'Temel Beceriler', usedBy: 411, ages: A },
  { id: 't19', title: 'Yeni 5 kelime öğren', emoji: '🗂️', category: 'learn', difficulty: 'medium', skill: 'Dil', usedBy: 297, ages: B },
  { id: 't20', title: 'Çantanı yarına hazırla', emoji: '🎒', category: 'learn', difficulty: 'easy', skill: 'Planlama', usedBy: 526, ages: AB },
  // Sağlık ve Spor
  { id: 't9', title: 'Dişlerini fırçala', emoji: '🪥', category: 'health', difficulty: 'easy', skill: 'Öz Bakım', usedBy: 1320, ages: ALL },
  { id: 't8', title: 'Yarın için kıyafetini seç', emoji: '👕', category: 'health', difficulty: 'easy', skill: 'Bağımsızlık', usedBy: 412, ages: A },
  { id: 't21', title: '20 dakika dışarıda oyna', emoji: '⚽', category: 'health', difficulty: 'easy', skill: 'Hareket', usedBy: 588, ages: ALL },
  { id: 't22', title: 'Bir bardak su iç', emoji: '💧', category: 'health', difficulty: 'easy', skill: 'Sağlıklı Alışkanlık', usedBy: 344, ages: ALL },
  { id: 't23', title: '15 dakika esneme / spor', emoji: '🤸', category: 'health', difficulty: 'medium', skill: 'Hareket', usedBy: 301, ages: B },
  // Odak ve Öz Denetim
  { id: 't24', title: 'Ekranı zamanında kapat', emoji: '📵', category: 'focus', difficulty: 'medium', skill: 'Öz Denetim', usedBy: 977, ages: AB },
  { id: 't25', title: '10 dakika tek işe odaklan', emoji: '⏱️', category: 'focus', difficulty: 'medium', skill: 'Odaklanma', usedBy: 356, ages: AB },
  { id: 't26', title: 'Sıranı sabırla bekle', emoji: '⏳', category: 'focus', difficulty: 'easy', skill: 'Sabır', usedBy: 219, ages: A },
  { id: 't27', title: 'Günün planını yap', emoji: '🗓️', category: 'focus', difficulty: 'hard', skill: 'Planlama', usedBy: 205, ages: B },
  // İlişki Kurma
  { id: 't14', title: 'Birine nazik bir söz söyle', emoji: '💬', category: 'relation', difficulty: 'easy', skill: 'Empati', usedBy: 154, ages: ALL },
  { id: 't28', title: 'Kardeşinle birlikte oyna', emoji: '🧩', category: 'relation', difficulty: 'easy', skill: 'Paylaşma', usedBy: 433, ages: ALL },
  { id: 't29', title: 'Aileyle sofrada sohbet et', emoji: '🍲', category: 'relation', difficulty: 'easy', skill: 'İletişim', usedBy: 287, ages: ALL },
  { id: 't30', title: 'Bir arkadaşını ara / yaz', emoji: '📞', category: 'relation', difficulty: 'medium', skill: 'Arkadaşlık', usedBy: 176, ages: B },
];
