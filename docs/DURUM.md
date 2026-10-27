# Proje durumu ve devam notu

Bu dosya, yeni bir Claude oturumunun kaldığı yerden devam edebilmesi için tutulur.
Son güncelleme: 13 Ekim 2026 (akşam).

> **19 Ekim 2026:** Ortak kurallar ve karar günlüğü artık `amy60946/ortak` deposunda (`ortak/DURUM.md`). Bu dosyanın aşağısı 13 Ekim tarihli eski nottur.
> Bu turda: İnceleme'de onay da `review_completion` ile gidiyor; görev ödülü 0–50; yaş grupları iki: 6–8 / 9–12 (eski C → B gösterilir).
> **21 Ekim 2026:** Üyelik (7 gün deneme, Aylık/Yıllık ekranı `PaywallScreen`, `src/billing.tsx`, ödeme henüz bağlı değil: `src/lib/billing.ts`), 15 dakikalık kodlar (geri sayım + "Yeni kod al"), Mesajlar sekmesi yeniden açık (çıkartma, okundu), + menüsünde Ödül (`RewardsScreen`: ödül ver, Güneş Taşı düş, çocuk isteği onayı), e-posta bağlantısıyla sessiz hesap değiştirme engellendi (`src/lib/auth.tsx`). Sunucu tarafı `ortak/supabase/proposed/2026102113…17*.sql`.
> **21 Ekim 2026 (gece):** Ödüller ekranı karma v2 (`src/screens/RewardsScreen.tsx`): bakiyede −, çocuk harfi → son onay kartı, değiş tokuşta süre çipleri, istek bandı ✓/✕ → onay, Öneriler + Tümü, Geçmiş sağ üstte; ilk kullanım ipuçları `src/components/FirstTip.tsx` + `src/data/rewardTips.ts`. Tasarım: https://claude.ai/artifact/LcoiwjvWAqE4tqHn79LpMj (Karma öneri, 2. sıra).
> **26 Ekim 2026:** İlk kullanım rehberi (`src/components/Onboarding.tsx`, tasarım G1 https://claude.ai/artifact/26QnkmgjYyRx3hZFvpRP9u): 5 adım (çocuk ekle · oyun kodu · görev ver · onayla · uzmanını ekle, isteğe bağlı); yeni aileye bir kez, Aile › Hesap › Nasıl kullanılır? ile yeniden; olaylar `onboarding.done` / `onboarding.skip`. Çocuk giriş kodunun altında QR (`src/components/QrCode.tsx`, içerik `pofiadasi://baglan?kod=<KOD>`, ortak `akislar.md` 2.0).
> **26 Ekim 2026 (öğleden sonra):** Uzman daveti (ortak `akislar.md` 10–14, öneri `20261026050000` + `20261026100000`): `src/screens/InviteScreen.tsx` (çocuk önerisini kontrol et/düzelt, uyarı + veli beyanı, Onayla ve paylaş, aynı ad, Bu davet bana ait değil, ardından tablet QR), `src/screens/CarePlanScreen.tsx` (Takip planı, Bugün uyguladım), `src/lib/clinicInvite.ts` (parentapp://davet/<anahtar>), kayıt ekranında davet bandı + Uzman kodum var, Uzmanım'da bekleyen davet, Takip planı, önceki uzman kayıtları anahtarı, belge rozeti (`clinician_verification` bayrağı kapalıyken görünmez), Görevler'de bekleyen davet bandı, Çocuk ekle'de aynı ad uyarısı. Eski sunucuda yeni işlevler yoksa bugünkü akış sürer.
> **27 Ekim 2026:** İlk kurulum akışı (ortak `akislar.md` 16, öneri `20261027120000_parent_setup_intake.sql`): Hoş geldin (Başla / Hesabım var) → Uzman kodun var mı? (`AuthScreens.tsx` WelcomeScreen, ExpertAskScreen, ExpertCodeScreen) → kayıt → aile soruları → Çocuk ekle / Kodla aileye katıl → (uzman davetiyse taslak çocuk Invite'ta onaylanır) → çocuk soruları (tanı/ilaç isteğe bağlı, açık rıza satırı) → çocuklar listesi → yükleniyor → takma ad + avatar → 3 "Tanıdık mı?" → Çocuğunun cihazını kuralım (`DeviceSetupScreen.tsx`: Başka cihaz / Bu cihaz, indirme bağlantısı, kod + QR) → kısa rehber. Kod: `src/screens/SetupScreen.tsx`, `src/data/intake.ts` (sorular, anahtarlar ortak P16), `src/lib/intake.ts`, `src/setupContext.tsx`. Kodla katılan eş çocuk sorularını görmez. Sunucuda `setup_completed_at` yoksa (öneri uygulanmadı) eski akış sürer. Yayında: `EXPO_PUBLIC_GAME_STORE_URL` (Pofi Adası App Store adresi) girilecek.
> **27 Ekim 2026 (akşam):** İnceleme ayrıntısı (ortak `akislar.md` 3 9c–9d, öneri `20261027130000_review_detail.sql`): `src/screens/ReviewScreen.tsx` satıra dokununca alt sayfa — motive etmek ne kadar zordu (1–5, uzmana akar), Güneş Taşı −/+ (0–6, varsayılan zorluğa göre), not (140), Reddet / Tekrar dene (yalnız bugün) / Onayla; satırda ✓ hızlı onay. `store.review(key, 'approved'|'rejected'|'retry', {note, motivation, stones})` eski sunucuda motivasyon/taşsız yeniden dener. Bildirim izni artık ilk açılışta sorulmaz: `src/components/PushAsk.tsx` ön sorusu rehber bitince ya da ilk incelemede (`lib/notifications.ts` shouldAskPush). İlk onay kutlaması `src/components/Dialog.tsx` + `src/lib/firsts.ts`. Görevler'de `retry` → "Tekrar denesin".
> **27 Ekim 2026 (gece):** Hazır rutinler (ortak `akislar.md` 3 adım 1a): `src/data/routines.ts` (6 rutin, katalog anahtarlarıyla), `src/screens/RoutineScreen.tsx` (kimin için, hafta içi/her gün, saatler, görev çıkar/adını-saatini değiştir, tek seferde ekle), Görev Oluştur'un üstünde kartlar, boş Görevler'de "Bir rutinle başla".
> **27 Ekim 2026 (gece, 2):** Ebeveyn görevleri + hediye dükkânı (ortak `akislar.md` 18, öneri `20261027140000_parent_tasks_gifts.sql`): `src/parentTasks.tsx` (ebeveyn atamaları, Yaptım işaretleri, taş defteri; sunucuda tablo yoksa ready=false ve bölümler gizli), Görev ayrıntılarında Ebeveynler bölümü, Görevler'de ebeveyn avatarı + Yaptım + "Ben" süzgeci, Aile › Ben › Güneş Taşım, Aile › çocuk › Güneş Taşı › Hesap, `src/screens/StonesScreen.tsx` (hesap dökümü), `src/screens/GiftShopScreen.tsx` (dükkân), `src/data/giftItems.ts` (eşya adları, game-app items.json'dan; emoji yok).
> **27 Ekim 2026 (gece, 3):** Hukuk metinleri (ortak `hukuk/`, öneri `20261027200000_legal.sql` + `_legal_seed.sql`, ekran metinleri `hukuk/50-uygulama-ici-metinler.md`): kayıtta Kullanım Koşulları kutusu (işaretlenmeden kayıt yok) + kutusuz aydınlatma satırı (`src/lib/legal.ts` markSignupConsent → oturumda `legal_accept`), açılışta/öne gelişte `legal_pending` → `LegalUpdateScreen`, kod/QR'dan önce veli onayı (`src/legal.tsx` ensureChildConsent: Aile › çocuk › Giriş kodu, cihaz kurulumu, davet sonrası tablet), Aile › Hesap › Yasal metinler (`LegalDocsScreen`, verdiğin izinler) ve KVKK başvurusu (`KvkkScreen`, kimin için, Başvurularım; bildirim `kvkk_answered`), Hesabımı sil ayrı ekran (`DeleteAccountScreen`: abonelik uyarısı, aile metni, SİL yaz), acil durum notu (gözlem notu, Uzmanım), "tanı değildir" (Gelişim), coin/taş notu (Ödüller tanıtımı), veli beyanı (çocuk ekle), üyelik metni (Apple 3.1.2, deneme kendiliğinden ücretlenmez), izin metinleri (`app.json`). Uzman davetinde "önceki uzmanın kayıtları" artık varsayılan KAPALI. Sunucuda işlev yoksa bugünkü akış.

## Kullanıcı hakkında
- Yazılımcı değil; platformları ilk kez kullanıyor. Her adımı sade Türkçeyle, tek tek, nereye tıklayacağını söyleyerek anlat.
- Amaç yayına almak değil: uygulamayı önizleme ve TestFlight ile deneyerek geliştirmek. App Store'a yayın şimdilik yok.
- Token, anahtar veya şifreleri sohbete yapıştırmasını asla isteme; ortam ayarlarına (Edit cloud environment) eklenir.

## Hesaplar ve ayarlar (tamam)
- GitHub deposu: `amy60946/parent-app`, çalışma dalı: `claude/laughing-babbage-wzv41p`
- Supabase projesi: `https://uhelhxqgpcjemadhsifx.supabase.co`
  - `supabase/migrations/20261013000000_init.sql` çalıştırıldı (9 tablo, RLS, `mail` kovası).
  - Email provider açık, **Confirm email kapalı** (geliştirme için; yayından önce açılacak, SMTP kurulacak).
  - Publishable (anon) anahtar repoda yok; yerel test için `.env`'e yazılır (bkz. `.env.example`). Kullanıcıdan tekrar istenebilir; paylaşılması güvenli anahtardır, secret anahtar asla istenmez.
- Expo hesabı: `amy60946`. `app.json` → ad **ParentApp**, kimlik `com.parentapp.ios`.
- Ortam ayarları: Allowed domains içinde `uhelhxqgpcjemadhsifx.supabase.co`, `expo.dev`, `api.expo.dev`, `u.expo.dev`; ortam değişkeni `EXPO_TOKEN` eklendi.
- Apple Developer Program: başvuru sırasında sorun çıktı, Apple desteği dönüş yapacak (bekleniyor).

## Yapılanlar
1. Supabase şeması + RLS, `src/lib/supabase.ts`, kalıcı `src/store.tsx` (Realtime dahil)
2. Kayıt / giriş / şifremi unuttum / yeni şifre ekranları, `parentapp://` deep link
3. Hesap silme, ebeveyn davet kodu, çocuk giriş kodu
4. Posta: fotoğraf, sesli mesaj
5. Avatarlar çizim görsellere hazır (`assets/avatars/README.md`)
6. Web önizlemesi (deneme veritabanı): `bash preview/build.sh` → Artifact olarak yayınlandı:
   https://claude.ai/artifact/QkoAjUUic8zUjtRaBUcyqB (güncellemek için aynı URL'ye yayınla)
7. Depo derlenebilir Expo projesi: `package.json`, `app.json`, `eas.json`, geçici simge

## ŞU ANKİ ODAK: Pofi Adası (çocuk oyunu, Unity) — plan onayı bekleniyor
- Kullanıcı ebeveyn tarafını (ParentApp) park etti. Çocuk oyunu "Pofi Adası" ayrı bir Unity uygulaması olacak (6–15 yaş, 12 pet, ada, mini oyunlar, görev → coin).
- Plan, riskler, açık sorular: **`docs/pofi/PLAN.md`**. Kullanıcı onay vermeden kod/varlık üretme. Açık sorular S1–S9 orada. Kararlar: yeni depo `pofi-adasi`; test yalnızca iPhone (WebGL önizleme → TestFlight); nihai 3D yapay zekâ + temizlik; ses şimdilik yok. Bekleyen: plan onayı, S2 (Unity hesabı + GitHub Secrets), S6–S9.
- Kullanıcının iki brief'i (oyun + 3D varlık) sohbette verildi. Özeti PLAN.md'de. Stil referansı: `ornek-gorsellerim.docx` (57 görsel, vinil oyuncak stili; karakterleri kopyalamak yasak).
- **Oyun deposu: `amy60946/pofi-adasi`** (dal `claude/zen-noether-nlt3wm`). Plan onaylandı (13 Ekim). Oyun deposundaki `CLAUDE.md` ve `docs/` asıl kaynak; bu dosya yalnızca yönlendirir.
- M0 iskeleti + CI orada. Unity lisansı (GitHub Secrets) kullanıcıdan bekleniyor: `docs/UNITY_LISANS.md`. 0A/0B konsept çalışması `docs/art/` altında.
- Bu ortamda Unity indirilemiyor (ağ politikası). Plan: GitHub Actions + GameCI. Blender `bpy` PyPI'dan kurulabiliyor.

## Sistem (kullanıcının anlattığı hedef)
- Bu uygulama **ebeveyn paneli**: ebeveyn çocuklara gerçek hayat görevi atar.
- Çocuk ayrı bir **oyun** tarafında görevleri görür, "tamamladım" işaretler; oyunda coin harcayarak daha zengin içeriğe erişir.
- Ebeveyn **İnceleme**'de tamamlanan/diğer durumdaki görevleri görüp onaylar → çocuk coin kazanır. (Çocuk tarafı henüz yok; İnceleme bu yüzden boş.)
- Aile > çocuk > Genel'deki **giriş kodu**, çocuğun oyuna girişi içindir. Ayrıntıları kullanıcıyla birlikte sonra tasarlanacak.

## M4: oyun bağlantısı (15 Ekim 2026, onaylandı)
- Sunucu eklemeleri oyun deposunda: `pofi-adasi/supabase/proposed/20261015000000_pofi_game.sql` (yaş bandı, görev durumları `declined`/`rejected` + `parent_note`, coin defteri `coin_ledger`, `game_items`, `game_saves`, RPC'ler). Uygulama adımları: `pofi-adasi/docs/M4_UYGULAMA.md`. **ParentApp'in bu sürümü o SQL uygulanmadan yayınlanmamalı** (yaş bandı, ret, bakiye, bağlantı kaldırma RPC'leri yoksa hata/boş görünür).
- ParentApp'teki eklemeler: çocuk eklerken ve Aile > çocuk > Genel'de oyundaki yaş grubu (`set_child_age_band`), İnceleme'de "Reddet" notla (`review_completion`, kayıt silinmez), çocuğun coin bakiyesi (`child_balance`), "Cihaz bağlantısını kaldır" (`unlink_child_device`). Görevler'de yeni durum etiketleri: Yapamadı / Reddedildi. Önizleme veritabanı (`preview/demo-supabase.ts`) bu RPC'leri taklit eder.

## Sıradaki adım
**Kullanıcının telefonda geri bildirimi (14 Ekim turu) uygulandı; Supabase'de 2 ayar bekleniyor:**
1. SQL Editor'da `supabase/migrations/20261014000000_task_repeat_order.sql` çalıştırılmalı (yoksa yeni görev kaydı hata verir).
2. Authentication > Sign In / Providers > **Anonymous Sign-Ins** açılmalı (çocuk kodu girişi için).

Bu turda yapılanlar: klavye her alanda yazılanı gösteriyor (alt sayfalar `src/components/Sheet.tsx`, iOS klavye yüksekliği `src/lib/useKeyboardHeight.ts`); tarih seçici iOS'ta açık temada + Vazgeç/Kaydet (karanlık modda boş görünüyordu; datetimepicker sürümü de Expo Go'nunkine eşitlendi); Posta → sohbet (`ChatScreen`); Görev Oluştur filtreleri sabit yükseklikte; tekrarlayan görevde hafta/ay günü seçimi; hatırlatma açıklaması; Görevler'de tamamla yuvarlağı kaldırıldı, sürükle-bırak sıralama + sola kaydırıp silme + düzenleme simgesi (`react-native-draggable-flatlist`, gesture-handler, reanimated); açılış ekranı çocuk için masalsı sihirli kod ekranı, ebeveyn girişi altta küçük bağlantı.

**Expo Go yayını (her değişiklikten sonra):**
- Expo projesi: https://expo.dev/accounts/amy60946/projects/parentapp (ID `dff6d69f-1b4f-4373-93ad-a999cde37ede`)
- EAS Update `preview` dalı, runtime `exposdk:57.0.0` (Expo Go uyumlu olsun diye `runtimeVersion.policy: sdkVersion`).
  **TestFlight build'inden önce `appVersion` politikasına geri dön.**
- `.env` yereldir; yeni oturumda kullanıcının anon anahtarıyla yeniden oluştur. Yayınlama:
  `set -a && . ./.env && set +a && npx eas-cli update --branch preview --environment preview --message "..." --non-interactive`
  (`--environment` ile .env otomatik okunmuyor; değişkenleri bu yüzden kabuğa yüklüyoruz.)
- Kullanıcı Expo Go'da açar: Expo Go > son açılanlar > ParentApp; ya da expo.dev'deki update sayfasındaki Preview QR kodu.
- Yeni yerel paket eklenirse yalnızca `npx expo install` ile ekle (Expo Go'daki yerel sürümle aynı olmalı); `npx expo install --check` temiz olmalı.
- Expo sunucusuna ortam değişkeni yazma (`eas env:create`) bu oturumda izin almadı; TestFlight aşamasında kullanıcı expo.dev'den elle ekleyebilir.
- Web önizlemesi (`bash preview/build.sh`) bu turda güncellendi ama Artifact yeniden yayınlanmadı.

**Apple onayı gelince (TestFlight):**
1. App Store Connect'te uygulama kaydı (ad: ParentApp, kimlik: `com.parentapp.ios`).
2. App Store Connect API anahtarını Expo'ya tanıt (kullanıcıya adım adım).
3. Expo ortam değişkenleri: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (expo.dev > proje > Environment variables).
4. `eas build --platform ios --profile production` + `eas submit` → TestFlight, iç test kullanıcısı olarak kullanıcıyı ekle.

## Bekleyen notlar
- UI iyileştirmeleri: kullanıcı önizlemeyi kullanıp tek tek söyleyecek.
- Yayından önce: Confirm email aç + custom SMTP, gizlilik politikası, Kids Category kuralları (README).

## 16 Ekim 2026 — iki ayrı uygulama
- **ParentApp = yalnızca ebeveyn uygulaması.** Açılış ekranı ebeveyn girişi; çocuk "sihirli kod" ekranı ParentApp'ten kaldırıldı.
  Çocuk giriş kodunu **Pofi Adası** oyununa yazar (`amy60946/pofi-adasi`). Sunucu, `redeem_child_code`, görev/onay akışı aynı.
  Eski sürümden kalan çocuk oturumu olan cihazda bilgi ekranı + "Ebeveyn girişine geç" (yalnız yerel oturum kapanır).
- TestFlight: `docs/TESTFLIGHT.md` (EAS Build + Submit, `.github/workflows/ios-testflight.yml`).
