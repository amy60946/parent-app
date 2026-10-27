// Çizim avatarlar.
// 1) Görseli bu klasöre aşağıdaki adla koy (PNG, şeffaf arka plan, 512×512 önerilir).
// 2) İlgili satırın başındaki // işaretini kaldır.
// Satır açılınca src/data/avatars.ts emoji yerine bu görseli kullanır.
// Not: require yolu sabit yazılmalı; olmayan bir dosyayı açmak uygulama derlemesini bozar.
export const avatarImages: Record<string, number | undefined> = {
  // Çocuk
  // marti: require('./marti.png'),
  // kedi: require('./kedi.png'),
  // sincap: require('./sincap.png'),
  // kopek: require('./kopek.png'),
  // kus: require('./kus.png'),
  // caretta: require('./caretta.png'),
  // 'boz-ayi': require('./boz-ayi.png'),
  // kurt: require('./kurt.png'),
  // keci: require('./keci.png'),
  // flamingo: require('./flamingo.png'),
  // fil: require('./fil.png'),
  // zebra: require('./zebra.png'),
  // at: require('./at.png'),
  // Ebeveyn: Okti anne/baba (kullanıcı seçimi 27 Ekim 2026; game-app art/parent_avatars, oyundaki Okti modelinden).
  // Kare, kendi pastel zeminli; yuvarlak kırpılır (avatars.ts full).
  okti_anne_1: require('./okti_anne_1.jpg'),
  okti_anne_2: require('./okti_anne_2.jpg'),
  okti_anne_3: require('./okti_anne_3.jpg'),
  okti_baba_1: require('./okti_baba_1.jpg'),
  okti_baba_2: require('./okti_baba_2.jpg'),
  okti_baba_3: require('./okti_baba_3.jpg'),
};
