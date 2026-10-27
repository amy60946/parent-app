import { Ionicons } from '@expo/vector-icons';

// Hediye dükkânındaki eşyaların adları (game-app Resources/Data/items.json, 27 Ekim 2026) ve simgeleri (emoji yok: kullanıcı kararı).
// Fiyat ve liste sunucudan (gift_items; ortak öneri 20261027140000). Burada olmayan eşya kimliğiyle gösterilir.
export type GiftKind = 'wear' | 'home' | 'decor';
export const giftItems: Record<string, { name: string; icon: keyof typeof Ionicons.glyphMap; kind: GiftKind }> = {
  glasses_round: { name: 'Yuvarlak gözlük', icon: 'glasses-outline', kind: 'wear' },
  glasses_sun: { name: 'Güneş gözlüğü', icon: 'glasses', kind: 'wear' },
  glasses_star: { name: 'Yıldız gözlük', icon: 'star-outline', kind: 'wear' },
  hat_cap: { name: 'Şapka (kasket)', icon: 'baseball-outline', kind: 'wear' },
  hat_straw: { name: 'Hasır şapka', icon: 'sunny-outline', kind: 'wear' },
  hat_beanie: { name: 'Bere', icon: 'snow-outline', kind: 'wear' },
  hat_crown: { name: 'Taç', icon: 'trophy-outline', kind: 'wear' },
  headphones: { name: 'Kulaklık', icon: 'headset-outline', kind: 'wear' },
  shirt_stripes: { name: 'Çizgili tişört', icon: 'shirt-outline', kind: 'wear' },
  shirt_hawaii: { name: 'Çiçekli gömlek', icon: 'flower-outline', kind: 'wear' },
  apron_sailor: { name: 'Denizci önlüğü', icon: 'boat-outline', kind: 'wear' },
  hoodie_soft: { name: 'Yumuşak sweatshirt', icon: 'shirt', kind: 'wear' },
  vest_explorer: { name: 'Kaşif yeleği', icon: 'compass-outline', kind: 'wear' },
  raincoat: { name: 'Yağmurluk', icon: 'rainy-outline', kind: 'wear' },
  scarf_knit: { name: 'Örgü atkı', icon: 'ribbon-outline', kind: 'wear' },
  sash_belt: { name: 'Kuşak', icon: 'ribbon', kind: 'wear' },
  backpack_small: { name: 'Küçük sırt çantası', icon: 'bag-handle-outline', kind: 'wear' },
  cape_hero: { name: 'Kahraman pelerini', icon: 'flash-outline', kind: 'wear' },
  badge_patch: { name: 'Arma (sırt yaması)', icon: 'shield-outline', kind: 'wear' },
  glove_mitten: { name: 'Eldiven', icon: 'hand-left-outline', kind: 'wear' },
  hand_flag: { name: 'Bayrakçık', icon: 'flag-outline', kind: 'wear' },
  home_bed: { name: 'Yumuşak yatak', icon: 'bed-outline', kind: 'home' },
  home_rug: { name: 'Halı', icon: 'square-outline', kind: 'home' },
  home_lamp: { name: 'Deniz kabuğu lamba', icon: 'bulb-outline', kind: 'home' },
  home_bookshelf: { name: 'Kitaplık', icon: 'library-outline', kind: 'home' },
  home_aquarium: { name: 'Akvaryum', icon: 'fish-outline', kind: 'home' },
  decor_umbrella: { name: 'Plaj şemsiyesi', icon: 'umbrella-outline', kind: 'decor' },
  decor_sandcastle: { name: 'Kum kalesi', icon: 'business-outline', kind: 'decor' },
  decor_palm: { name: 'Minik palmiye', icon: 'leaf-outline', kind: 'decor' },
  decor_lanterns: { name: 'Festival fenerleri', icon: 'color-palette-outline', kind: 'decor' },
};
export const giftName = (id?: string) => (id && giftItems[id]?.name) || id || '';
export const giftKinds: { id: GiftKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Tümü' }, { id: 'wear', label: 'Giyecek' }, { id: 'home', label: 'Ev' }, { id: 'decor', label: 'Süs' },
];
