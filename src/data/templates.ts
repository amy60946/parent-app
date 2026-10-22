import { Difficulty } from '../theme';
import catalog from './taskCatalog.json';

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

// Kategori = beceri (kullanıcı kararı; ortak/sozlesme/ekonomi.md 5B, durumlar.md 9). Görevde `skill` alanına anahtar yazılır.
export type Skill = 'teamwork' | 'stamina' | 'knowledge' | 'strength' | 'focus' | 'kindness';
export const categorySkill: Record<Category, Skill> = {
  home: 'teamwork', mind: 'stamina', learn: 'knowledge', health: 'strength', focus: 'focus', relation: 'kindness',
};
export const skillLabels: Record<Skill, string> = {
  teamwork: 'Takım Çalışması', stamina: 'Dayanıklılık', knowledge: 'Bilgi', strength: 'Güç', focus: 'Odak', kindness: 'Nezaket',
};
// Eski kayıtlarda serbest metin olabilir ("Okuma", "Özel"): anahtar değilse olduğu gibi gösterilir
export const skillLabel = (s?: string | null) => (s && s in skillLabels ? skillLabels[s as Skill] : s || '');
export const categoryLabel = (c: Category) => categories.find((x) => x.id === c)?.label ?? '';

// Yaş grupları = oyunun yaş bandı (durumlar.md 9): K 5 ve altı, A 6–8, B 9–12, C 13 ve üstü
export type TemplateAge = 'K' | 'A' | 'B' | 'C';
export const templateAges: { id: TemplateAge; label: string }[] = [
  { id: 'K', label: '5 ve altı' },
  { id: 'A', label: '6–8' },
  { id: 'B', label: '9–12' },
  { id: 'C', label: '13 ve üstü' },
];

export type Template = {
  id: string; // katalogda `jt_…`, ebeveynin kendi görevinde `c_…`
  title: string;
  emoji: string;
  category: Category; // ana kategori
  categories: Category[]; // süzgeç etiketleri (ilki ana kategori)
  difficulty: Difficulty;
  coins: number; // varsayılan ödül (kolay 5, orta 10, zor 20); ebeveyn değiştirebilir
  skill: string; // beceri anahtarı (Skill)
  ages?: TemplateAge[]; // uygun yaş grupları; yoksa hepsi
  sort: number; // katalog sırası (küçük olan önce)
  custom?: boolean;
};

// Görev kataloğu: ortak/veri/gorev_sablonlari.json (298 şablon). Sunucudaki task_templates uygulanınca
// oradan okunabilir; bu gömülü kopya çevrimdışı yedektir.
type Row = { key: string; title: string; emoji: string; category: string; categories: string[]; ages: string[]; difficulty: string; coins: number; skill: string; sort: number };
export const templates: Template[] = (catalog as Row[]).map((r) => ({
  id: r.key, title: r.title, emoji: r.emoji, category: toCategory(r.category),
  categories: r.categories.map(toCategory), difficulty: r.difficulty as Difficulty, coins: r.coins,
  skill: r.skill, ages: r.ages as TemplateAge[], sort: r.sort,
}));
