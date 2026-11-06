// Çizim avatarlar.
// 1) Görseli bu klasöre aşağıdaki adla koy (PNG, şeffaf arka plan, 512×512 önerilir).
// 2) İlgili satırın başındaki // işaretini kaldır.
// Satır açılınca src/data/avatars.ts emoji yerine bu görseli kullanır.
// Not: require yolu sabit yazılmalı; olmayan bir dosyayı açmak uygulama derlemesini bozar.
export const avatarImages: Record<string, number | undefined> = {
  // Çocuk: Okti'nin çocuk hâli, 6 kız + 6 erkek (kullanıcı isteği 28 Ekim 2026; game-app art/child_avatars)
  okti_kiz_1: require('./okti_kiz_1.jpg'),
  okti_kiz_2: require('./okti_kiz_2.jpg'),
  okti_kiz_3: require('./okti_kiz_3.jpg'),
  okti_kiz_4: require('./okti_kiz_4.jpg'),
  okti_kiz_5: require('./okti_kiz_5.jpg'),
  okti_kiz_6: require('./okti_kiz_6.jpg'),
  okti_erkek_1: require('./okti_erkek_1.jpg'),
  okti_erkek_2: require('./okti_erkek_2.jpg'),
  okti_erkek_3: require('./okti_erkek_3.jpg'),
  okti_erkek_4: require('./okti_erkek_4.jpg'),
  okti_erkek_5: require('./okti_erkek_5.jpg'),
  okti_erkek_6: require('./okti_erkek_6.jpg'),
  // Ebeveyn: Okti anne/baba (kullanıcı seçimi 27 Ekim 2026; game-app art/parent_avatars, oyundaki Okti modelinden).
  // Kare, kendi pastel zeminli; yuvarlak kırpılır (avatars.ts full).
  okti_anne_1: require('./okti_anne_1.jpg'),
  okti_anne_2: require('./okti_anne_2.jpg'),
  okti_anne_3: require('./okti_anne_3.jpg'),
  okti_baba_1: require('./okti_baba_1.jpg'),
  okti_baba_2: require('./okti_baba_2.jpg'),
  okti_baba_3: require('./okti_baba_3.jpg'),
};
