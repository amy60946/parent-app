# Proje durumu ve devam notu

Bu dosya, yeni bir Claude oturumunun kaldığı yerden devam edebilmesi için tutulur.
Son güncelleme: 13 Ekim 2026 (akşam).

> **19 Ekim 2026:** Ortak kurallar ve karar günlüğü artık `amy60946/ortak` deposunda (`ortak/DURUM.md`). Bu dosyanın aşağısı 13 Ekim tarihli eski nottur.
> Bu turda: İnceleme'de onay da `review_completion` ile gidiyor; görev ödülü 0–50; yaş grupları iki: 6–8 / 9–12 (eski C → B gösterilir).

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

## Sistem (kullanıcının anlattığı hedef, Joon benzeri)
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
