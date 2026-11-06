import { Ionicons } from '@expo/vector-icons';

// Çıkartmalar: anahtarlar sunucuyla ve oyunla aynı (ortak/sozlesme/durumlar.md 13). Görseli her uygulama kendi çizer.
export type StickerKey = 'heart' | 'star' | 'thumbs_up' | 'hug' | 'smile' | 'laugh' | 'wow' | 'sad' | 'sleepy' | 'party' | 'thanks' | 'love_you';

export const stickers: { key: StickerKey; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'heart', label: 'Kalp', icon: 'heart', color: '#D9455F' },
  { key: 'love_you', label: 'Seni seviyorum', icon: 'heart-circle', color: '#D9455F' },
  { key: 'star', label: 'Yıldız', icon: 'star', color: '#E9B22B' },
  { key: 'thumbs_up', label: 'Harika', icon: 'thumbs-up', color: '#2F7D4A' },
  { key: 'hug', label: 'Sarılma', icon: 'people', color: '#6B5BD2' },
  { key: 'smile', label: 'Gülümseme', icon: 'happy', color: '#E9B22B' },
  { key: 'laugh', label: 'Kahkaha', icon: 'happy-outline', color: '#E08A1E' },
  { key: 'wow', label: 'Vay', icon: 'flash', color: '#E08A1E' },
  { key: 'sad', label: 'Üzgün', icon: 'sad', color: '#5A7BB5' },
  { key: 'sleepy', label: 'Uykulu', icon: 'moon', color: '#5A6B8C' },
  { key: 'party', label: 'Kutlama', icon: 'sparkles', color: '#C04FB0' },
  { key: 'thanks', label: 'Teşekkürler', icon: 'ribbon', color: '#2F7D4A' },
];

export const stickerOf = (key: string) => stickers.find((s) => s.key === key);
