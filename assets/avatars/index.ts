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
  // Ebeveyn
  // kadin: require('./kadin.png'),
  // erkek: require('./erkek.png'),
};
