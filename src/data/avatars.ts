import { avatarImages } from '../../assets/avatars';

// Görseli olmayan simgede emoji gösterilir. Çizim görseller assets/avatars/ altına
// `file` adıyla konur ve assets/avatars/index.ts içinde açılır; Avatar bileşeni
// image varsa onu gösterir. `id` veritabanında saklandığı için değiştirilmemeli.
export type AvatarDef = { id: string; name: string; emoji: string; file: string; image?: number; full?: boolean }; // full: görsel dairenin tamamını kaplar

const withImage = (a: Omit<AvatarDef, 'image'>): AvatarDef => ({ ...a, image: avatarImages[a.file] });

// Çocuk: Okti'nin çocuk hâli, 6 kız + 6 erkek (kullanıcı isteği 28 Ekim 2026; game-app art/child_avatars; kimlikler ortak durumlar.md §6a)
export const childAvatars: AvatarDef[] = [
  { id: 'okti_kiz_1', name: 'Kurdeleli', emoji: '👧', file: 'okti_kiz_1', full: true },
  { id: 'okti_kiz_2', name: 'Çiçek tokalı', emoji: '👧', file: 'okti_kiz_2', full: true },
  { id: 'okti_kiz_3', name: 'Taçlı', emoji: '👧', file: 'okti_kiz_3', full: true },
  { id: 'okti_kiz_4', name: 'Kalp gözlüklü', emoji: '👧', file: 'okti_kiz_4', full: true },
  { id: 'okti_kiz_5', name: 'Bereli', emoji: '👧', file: 'okti_kiz_5', full: true },
  { id: 'okti_kiz_6', name: 'Kulaklıklı', emoji: '👧', file: 'okti_kiz_6', full: true },
  { id: 'okti_erkek_1', name: 'Kasketli', emoji: '👦', file: 'okti_erkek_1', full: true },
  { id: 'okti_erkek_2', name: 'Pervaneli', emoji: '👦', file: 'okti_erkek_2', full: true },
  { id: 'okti_erkek_3', name: 'Pilot', emoji: '👦', file: 'okti_erkek_3', full: true },
  { id: 'okti_erkek_4', name: 'Güneş gözlüklü', emoji: '👦', file: 'okti_erkek_4', full: true },
  { id: 'okti_erkek_5', name: 'Antenli', emoji: '👦', file: 'okti_erkek_5', full: true },
  { id: 'okti_erkek_6', name: 'Köpek balığı şapkalı', emoji: '👦', file: 'okti_erkek_6', full: true },
].map(withImage);

// Cinsiyete göre ilk simge (formda cinsiyet seçilince, avatar elle seçilmediyse)
export const defaultChildAvatar = (gender?: 'kız' | 'erkek' | null) => (gender === 'erkek' ? 'okti_erkek_1' : 'okti_kiz_1');

// Eski hayvan kimlikleri (veritabanında kalmış olabilir; veri değiştirilmez): çocuğun cinsiyetine göre bir Okti çocuğu;
// cinsiyet yoksa listedeki sırası çift olan kız, tek olan erkek. Kural ortak/sozlesme/durumlar.md §6a.
const LEGACY_CHILD = ['martı', 'kedi', 'sincap', 'köpek', 'kuş', 'caretta', 'ayı', 'kurt', 'keçi', 'flamingo', 'fil', 'zebra', 'at'];
export function childAvatarId(id: string, gender?: 'kız' | 'erkek' | null): string {
  const i = LEGACY_CHILD.indexOf(id);
  if (i < 0) return id;
  const g = gender ?? (i % 2 === 0 ? 'kız' : 'erkek');
  return `okti_${g === 'kız' ? 'kiz' : 'erkek'}_${(i % 6) + 1}`;
}

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
  [...childAvatars, ...parentAvatars].find((a) => a.id === parentAvatarId(childAvatarId(id))) ?? childAvatars[0];
