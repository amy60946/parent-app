import { avatarImages } from '../../assets/avatars';

// Görsel eklenene kadar emoji gösterilir. Çizim görseller assets/avatars/ altına
// `file` adıyla konur ve assets/avatars/index.ts içinde açılır; Avatar bileşeni
// image varsa onu gösterir. `id` veritabanında saklandığı için değiştirilmemeli.
export type AvatarDef = { id: string; name: string; emoji: string; file: string; image?: number; full?: boolean }; // full: görsel dairenin tamamını kaplar

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

// Ebeveyn: Okti'nin anne ve baba hâlleri (kullanıcı seçimi 27 Ekim 2026; kimlikler ortak/sozlesme/durumlar.md, oyun aynılarını gösterir)
export const parentAvatars: AvatarDef[] = [
  { id: 'okti_anne_1', name: 'Çiçekli', emoji: '👩', file: 'okti_anne_1', full: true },
  { id: 'okti_anne_2', name: 'Hasır şapkalı', emoji: '👩', file: 'okti_anne_2', full: true },
  { id: 'okti_anne_3', name: 'Fiyonklu', emoji: '👩', file: 'okti_anne_3', full: true },
  { id: 'okti_baba_1', name: 'Bıyıklı', emoji: '👨', file: 'okti_baba_1', full: true },
  { id: 'okti_baba_2', name: 'Kaptan', emoji: '👨', file: 'okti_baba_2', full: true },
  { id: 'okti_baba_3', name: 'Kasketli', emoji: '👨', file: 'okti_baba_3', full: true },
].map(withImage);

// Eski kimlikler (veritabanında kalmış olabilir; profiles.avatar varsayılanı 'erkek'): Okti karşılığıyla gösterilir
const LEGACY: Record<string, string> = { 'kadın': 'okti_anne_1', 'erkek': 'okti_baba_1' };
export const parentAvatarId = (id: string) => LEGACY[id] ?? id;

export const findAvatar = (id: string): AvatarDef =>
  [...childAvatars, ...parentAvatars].find((a) => a.id === parentAvatarId(id)) ?? childAvatars[1];
