// Uzman paylaşımı metinleri (ortak/sozlesme/hukuk_notlari.md 3B, 3E–3F). Metin değişirse onay sürümü de değişir.
// Ekranda kısa satır + i; tam metin i'de (kullanıcı kararı 26 Ekim 2026: uzun açıklamalar i'de).

// uzman-paylasim-v1
export const SHARE_WARNING = 'ClinicApp uzmanların kimliğini ve mesleki belgelerini doğrulamaz. Çocuğunun bilgilerini paylaşmadan önce bu uzmanı gerçek hayatta tanıdığından ve davetin ondan geldiğinden emin ol. Emin değilsen paylaşma; uzmanını bildiğin bir yoldan arayıp sor. Paylaşımı istediğin an Uzmanım bölümünden durdurabilirsin.';
export const SHARE_WARNING_SHORT = 'Uzmanlar doğrulanmaz. Tanımadığın biriyle paylaşma.';

// uzman-gecis-v1
export const historyConsent = (children: string, clinician: string) =>
  `Çocuğum ${children} için daha önce çalıştığım uzman(lar)ın ClinicApp'e girdiği notların, hedeflerin, haftalık değerlendirmelerin, görev önerilerinin, aile programının ve benim uygulama kayıtlarımın, takibin kesintisiz sürmesi amacıyla yeni uzmanım ${clinician} ile yalnız okunur olarak paylaşılmasına açık rıza veriyorum. Önceki uzmanın adı ve bilgileri yeni uzmana gösterilmez. Bu izni Uzmanım bölümünden istediğim an geri alabilirim; geri aldığımda erişim hemen sona erer.`;

// Uzmanın gördükleri: ekranda tek satır, listesi i'de
export const SCOPE_SHORT = 'Görevler ve davranış kayıtları paylaşılır; mesajlar ve coin paylaşılmaz.';
export const SCOPE_FULL = [
  'Paylaşılır:',
  '• Görevler ve tamamlanma durumu (saatiyle)',
  '• "Yapamam" yanıtları ve nedenleri',
  '• Bu uygulamada eklediğin davranış kayıtları',
  '',
  'Paylaşılmaz:',
  '• Mesajlar, fotoğraf ve sesler',
  '• Coin bakiyesi ve oyun içi bilgiler',
  '',
  'Uzman verileri yalnız okur ve sana görev önerebilir; görev eklemek senin kararındır. Paylaşımı istediğin an Uzmanım bölümünden durdurabilirsin.',
].join('\n');

// Uzman bağla › "Hayır, kodum yok": ebeveyn uzmanına ClinicApp'i anlatır (paylaşım metni; kişisel veri içermez)
export const TELL_CLINICIAN = 'Merhaba, çocuğumun günlük rutinlerini ve görevlerini ParentApp ile takip ediyorum. ClinicApp ile (yalnız benim onayımla) ilerlemesini görebilir, eve program ve görev önerisi gönderebilirsiniz. Klinik hesabınızı açınca bana bir davet kodu gönderebilir misiniz?';

// Uzmandan ayırma / uzmanı kaldırma (ortak akislar.md 5, 8: revoke_clinic_link): uzman yeni veriyi göremez, aldığı notlar onda kalır
export const unlinkText = (child: string, clinician: string) =>
  `${clinician}, ${child} için yeni görevleri ve davranış kayıtlarını artık göremez. Daha önce aldığı notlar uzmanda kalır. İstersen sonra yeni bir kodla yeniden paylaşabilirsin.`;
export const removeText = (clinician: string) =>
  `${clinician} ile bütün çocuklarının paylaşımı durur; uzman yeni verileri göremez ve sana görev önerisi gönderemez. Daha önce aldığı notlar uzmanda kalır.`;
