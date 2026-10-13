// Geçici olarak emoji kullanılıyor. Çizim avatarlar hazır olunca `image` alanı
// (require('../../assets/avatars/kedi.png')) ile değiştirilecek; Avatar bileşeni
// image varsa onu gösterir.
export type AvatarDef = { id: string; name: string; emoji: string; image?: number };

export const childAvatars: AvatarDef[] = [
  { id: 'martı', name: 'Martı', emoji: '🕊️' },
  { id: 'kedi', name: 'Kedi', emoji: '🐱' },
  { id: 'sincap', name: 'Sincap', emoji: '🐿️' },
  { id: 'köpek', name: 'Köpek', emoji: '🐶' },
  { id: 'kuş', name: 'Kuş', emoji: '🐦' },
  { id: 'caretta', name: 'Caretta caretta', emoji: '🐢' },
  { id: 'ayı', name: 'Boz ayı', emoji: '🐻' },
  { id: 'kurt', name: 'Kurt', emoji: '🐺' },
  { id: 'keçi', name: 'Keçi', emoji: '🐐' },
  { id: 'flamingo', name: 'Flamingo', emoji: '🦩' },
  { id: 'fil', name: 'Fil', emoji: '🐘' },
  { id: 'zebra', name: 'Zebra', emoji: '🦓' },
  { id: 'at', name: 'At', emoji: '🐴' },
];

export const parentAvatars: AvatarDef[] = [
  { id: 'kadın', name: 'Kadın', emoji: '👩' },
  { id: 'erkek', name: 'Erkek', emoji: '👨' },
];

export const findAvatar = (id: string): AvatarDef =>
  [...childAvatars, ...parentAvatars].find((a) => a.id === id) ?? childAvatars[1];
