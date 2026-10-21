import { Ionicons } from '@expo/vector-icons';

// İlk kullanımda bir kez gösterilen kısa ipuçları (Ödüller ekranı). Her biri en çok 3 satır.
export type Tip = { icon: keyof typeof Ionicons.glyphMap; title: string; lines: string[]; ok: string };

export const rewardTips = {
  create: {
    icon: 'gift-outline',
    title: 'Az ve ulaşılabilir başla',
    lines: [
      '3–5 ödül yeter; biri birkaç günde alınabilsin.',
      'Birlikte yapılan şeyler (park, oyun, pasta) eşyadan daha iyi çalışır.',
    ],
    ok: 'Anladım',
  },
  give: {
    icon: 'sunny-outline',
    title: 'Ödül verirken',
    lines: [
      'Ödülü çocuğun zorlandığı işlere bağla; zaten sevdiği işlere değil.',
      'Ne yaptığını söyleyerek öv: "Odanı kendin topladın."',
      'Hemen ver; beklemek etkisini azaltır.',
    ],
    ok: 'Anladım, devam et',
  },
  deduct: {
    icon: 'remove-circle-outline',
    title: 'Taş düşürmeden önce',
    lines: [
      'Yalnız önceden birlikte konuştuğunuz kurallar için kullan.',
      'Seyrek olsun: her düşürmeye karşı en az 4–5 kazanç.',
      'Sakin bir anda, nedenini tek cümleyle söyle. Adası etkilenmez.',
    ],
    ok: 'Anladım, devam et',
  },
  request: {
    icon: 'hand-left-outline',
    title: 'Çocuğun bir ödül istedi',
    lines: [
      'Taşı yetiyorsa sözünü tut; kazanılan ödül geri alınmaz.',
      'Şimdi olmuyorsa "hayır" yerine ne zaman olacağını söyle.',
    ],
    ok: 'Anladım, devam et',
  },
} satisfies Record<string, Tip>;

export type TipKey = keyof typeof rewardTips;
