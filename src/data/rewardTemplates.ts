import { Ionicons } from '@expo/vector-icons';

// Önerilen ödüller (Güneş Taşı fiyatlarıyla). Görev 1/2/3 taş kazandırır: fiyatlar buna göre.
// Değiş tokuş ödülleri "cost taş = unitAmount birim" (dakika ekran süresi / TL harçlık); ortak/sozlesme/ekonomi.md 9.
export type RewardKind = 'item' | 'exchange';
export type RewardUnit = 'minute' | 'money';
export type RewardIcon = keyof typeof Ionicons.glyphMap;

// group: Öneriler › Tümü ekranındaki bölüm (Değiş tokuş / Etkinlik / Eşya)
export type RewardGroup = 'exchange' | 'activity' | 'thing';
export type RewardTemplate = { title: string; icon: RewardIcon; kind: RewardKind; cost: number; unit?: RewardUnit; unitAmount?: number; group: RewardGroup };

export const rewardTemplates: RewardTemplate[] = [
  { title: 'Ekran süresi', icon: 'phone-portrait-outline', kind: 'exchange', cost: 1, unit: 'minute', unitAmount: 10, group: 'exchange' },
  { title: 'Harçlık', icon: 'wallet-outline', kind: 'exchange', cost: 2, unit: 'money', unitAmount: 5, group: 'exchange' },
  { title: 'Aileyle özel vakit', icon: 'people-outline', kind: 'item', cost: 4, group: 'activity' },
  { title: 'Sevdiği bir tatlı', icon: 'ice-cream-outline', kind: 'item', cost: 5, group: 'thing' },
  { title: 'Çıkartma paketi', icon: 'star-outline', kind: 'item', cost: 8, group: 'thing' },
  { title: 'Yeni bir kitap', icon: 'book-outline', kind: 'item', cost: 25, group: 'thing' },
  { title: 'Arkadaşlarıyla 30 dakika fazladan oyun', icon: 'football-outline', kind: 'item', cost: 8, group: 'activity' },
  { title: 'Dışarıda yemek', icon: 'pizza-outline', kind: 'item', cost: 10, group: 'activity' },
  { title: 'Aile film ya da oyun gecesi', icon: 'film-outline', kind: 'item', cost: 10, group: 'activity' },
  { title: 'Dondurma yemeye çıkmak', icon: 'ice-cream-outline', kind: 'item', cost: 10, group: 'activity' },
  { title: 'Annesi ya da babasıyla etkinlik', icon: 'basketball-outline', kind: 'item', cost: 12, group: 'activity' },
  { title: 'Yatma saatini 30 dakika ertelemek', icon: 'moon-outline', kind: 'item', cost: 18, group: 'activity' },
  { title: 'Seçtiği bir ev işini atlamak', icon: 'sparkles-outline', kind: 'item', cost: 40, group: 'activity' },
  { title: 'Yeni bir oyuncak', icon: 'gift-outline', kind: 'item', cost: 50, group: 'thing' },
  { title: 'Arkadaşıyla pijama partisi', icon: 'bed-outline', kind: 'item', cost: 100, group: 'activity' },
];

// Simge seçici
export const rewardIcons: RewardIcon[] = [
  'gift-outline', 'film-outline', 'ice-cream-outline', 'pizza-outline', 'game-controller-outline', 'phone-portrait-outline',
  'wallet-outline', 'bicycle-outline', 'football-outline', 'basketball-outline', 'balloon-outline', 'moon-outline',
  'book-outline', 'musical-notes-outline', 'airplane-outline', 'paw-outline', 'people-outline', 'star-outline',
  'cart-outline', 'color-palette-outline', 'bed-outline', 'sparkles-outline', 'restaurant-outline', 'happy-outline',
];

// Sunucuda simge anahtarı "-outline" olmadan saklanır (ör. "film"); gösterirken eklenir.
export const iconKey = (i: RewardIcon) => String(i).replace(/-outline$/, '');
export const iconOf = (key?: string): RewardIcon => {
  const k = `${key ?? 'gift'}-outline` as RewardIcon;
  return k in Ionicons.glyphMap ? k : 'gift-outline';
};

export const groupLabel: Record<RewardGroup, string> = { exchange: 'Değiş tokuş', activity: 'Etkinlik', thing: 'Eşya' };
export const unitShort: Record<RewardUnit, string> = { minute: 'dk', money: 'TL' };

export const unitLabel: Record<RewardUnit, string> = { minute: 'dakika', money: 'TL' };
