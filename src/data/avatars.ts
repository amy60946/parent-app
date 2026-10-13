import { avatarImages } from '../../assets/avatars';

// Görsel eklenene kadar emoji gösterilir. Çizim görseller assets/avatars/ altına
// `file` adıyla konur ve assets/avatars/index.ts içinde açılır; Avatar bileşeni
// image varsa onu gösterir. `id` veritabanında saklandığı için değiştirilmemeli.
export type AvatarDef = { id: string; name: string; emoji: string; file: string; image?: number };

const withImage = (a: Omit<AvatarDef, 'image'>): AvatarDef => ({ ...a, image: avatarImages[a.file] });

export const childAvatars: AvatarDef[] = [
  { id: 'martı', name: 'Martı', emoji: '🕊️', file: 'marti' },
  { id: 'kedi', name: 'Kedi', emoji: '🐱', file: 'kedi' },
  { id: 'sincap', name: 'Sincap', emoji: '🐿️', file: 'sincap' },
  { id: 'köpek', name: 'Köpek', emoji: '🐶', file: 'kopek' },
  { id: 'kuş', name: 'Kuş', emoji: '🐦', file: 'kus' },
  { id: 'caretta', name: 'Caretta caretta', emoji: '🐢', file: 'caretta' },
  { id: 'ayı', name: 'Boz ayı', emoji: '🐻', file: 'boz-ayi' },
  { id: 'kurt', name: 'Kurt', emoji: '🐺', file: 'kurt' },
  { id: 'keçi', name: 'Keçi', emoji: '🐐', file: 'keci' },
  { id: 'flamingo', name: 'Flamingo', emoji: '🦩', file: 'flamingo' },
  { id: 'fil', name: 'Fil', emoji: '🐘', file: 'fil' },
  { id: 'zebra', name: 'Zebra', emoji: '🦓', file: 'zebra' },
  { id: 'at', name: 'At', emoji: '🐴', file: 'at' },
].map(withImage);

export const parentAvatars: AvatarDef[] = [
  { id: 'kadın', name: 'Kadın', emoji: '👩', file: 'kadin' },
  { id: 'erkek', name: 'Erkek', emoji: '👨', file: 'erkek' },
].map(withImage);

export const findAvatar = (id: string): AvatarDef =>
  [...childAvatars, ...parentAvatars].find((a) => a.id === id) ?? childAvatars[1];
