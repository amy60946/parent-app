# Proje durumu ve devam notu

Bu dosya, yeni bir Claude oturumunun kaldığı yerden devam edebilmesi için tutulur.
Son güncelleme: 13 Ekim 2026.

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
- Expo hesabı: `amy60946`. `app.json` → ad **Fidan**, kimlik `com.fidan.ebeveyn`.
- Ortam ayarları: Allowed domains içinde `uhelhxqgpcjemadhsifx.supabase.co`, `expo.dev`, `api.expo.dev`, `u.expo.dev`; ortam değişkeni `EXPO_TOKEN` eklendi.
- Apple Developer Program: başvuru sırasında sorun çıktı, Apple desteği dönüş yapacak (bekleniyor).

## Yapılanlar
1. Supabase şeması + RLS, `src/lib/supabase.ts`, kalıcı `src/store.tsx` (Realtime dahil)
2. Kayıt / giriş / şifremi unuttum / yeni şifre ekranları, `fidan://` deep link
3. Hesap silme, ebeveyn davet kodu, çocuk giriş kodu
4. Posta: fotoğraf, sesli mesaj
5. Avatarlar çizim görsellere hazır (`assets/avatars/README.md`)
6. Web önizlemesi (deneme veritabanı): `bash preview/build.sh` → Artifact olarak yayınlandı:
   https://claude.ai/artifact/QkoAjUUic8zUjtRaBUcyqB (güncellemek için aynı URL'ye yayınla)
7. Depo derlenebilir Expo projesi: `package.json`, `app.json`, `eas.json`, geçici simge

## Sıradaki adım
**Expo Go ile telefonda deneme (Apple hesabı beklenirken):**
1. `EXPO_TOKEN` ortamda var mı kontrol et (değerini yazdırma).
2. `npm install`, sonra `npx eas-cli init` (proje kimliğini `app.json`'a ekler), `npx eas-cli update:configure`.
3. `.env` dosyasını Supabase adresi + publishable anahtarla oluştur (anahtarı kullanıcıdan iste).
4. `npx eas-cli update --branch preview --message "..."` ile yayınla; kullanıcıya Expo Go'da nasıl açacağını adım adım anlat (expo.dev'deki proje > Updates sayfasındaki QR/bağlantı).

**Apple onayı gelince (TestFlight):**
1. App Store Connect'te uygulama kaydı (ad: Fidan, kimlik: `com.fidan.ebeveyn`).
2. App Store Connect API anahtarını Expo'ya tanıt (kullanıcıya adım adım).
3. Expo ortam değişkenleri: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (expo.dev > proje > Environment variables).
4. `eas build --platform ios --profile production` + `eas submit` → TestFlight, iç test kullanıcısı olarak kullanıcıyı ekle.

## Bekleyen notlar
- UI iyileştirmeleri: kullanıcı önizlemeyi kullanıp tek tek söyleyecek.
- Yayından önce: Confirm email aç + custom SMTP, gizlilik politikası, Kids Category kuralları (README).
