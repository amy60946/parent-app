# ParentApp — Claude için çalışma notları

ParentApp, ebeveynin kullandığı uygulama (Expo / React Native, TypeScript). Üç üründen biri; üçü ayrı uygulama, **tek Supabase projesi**:

| Ürün | Kim | Depo |
|---|---|---|
| Pofi Adası (GameApp) | Çocuk | `amy60946/game-app` (Unity) |
| **ParentApp** | Ebeveyn (aile aboneliği) | `amy60946/parent-app` (bu depo) |
| ClinicApp | Uzman (klinisyen başına ücret) | `amy60946/clinic-app` |

## Ortak kaynak: `amy60946/ortak`

- Veritabanı şeması, RPC'ler, durum adları, coin/XP kuralları ve karar günlüğü **`ortak`** deposundadır. Oturuma eklenmemişse kullanıcıya söyle.
- Her işe başlamadan önce `ortak/CLAUDE.md`, `ortak/DURUM.md` ve ilgili `ortak/sozlesme/*` dosyasını oku.
- Ortak bir şey değişecekse önce `ortak` güncellenir (SQL `proposed/` + test + sözleşme + DURUM satırı), sonra bu uygulama. Bu depodaki `supabase/` klasörü **eski kopyadır**, yeni SQL buraya yazılmaz.
- Oturum sonunda `ortak/DURUM.md`'ye bir satır yaz.

## Kullanıcı ve iletişim

- Kullanıcı yazılımcı değil: **Türkçe**, sade dille, adım adım ve nereye tıklayacağını söyleyerek anlat. Belirsiz kararda kısa soru sor; kapsam dışına çıkma.
- Şifre/anahtar sohbete yapıştırılmaz; GitHub Secrets'a eklenir. Uygulamaya yalnız Supabase publishable anahtarı girer (`EXPO_PUBLIC_SUPABASE_KEY`, CI'da `SUPABASE_PUBLISHABLE_KEY` secret'ından `.env`). `sb_secret_` / `service_role` asla.
- Push yalnız oturumun `claude/...` dalına; kullanıcı istemedikçe PR açılmaz.
- "Fidan" adı hiçbir yerde kullanılmaz. Uygulama adı ParentApp, bundle `com.parentapp.ios`, şema `parentapp://`.

## Teknik notlar

- Doğrulama: `npx tsc --noEmit`. Web önizleme: `preview/` (deneme veritabanı `preview/demo-supabase.ts`).
- iOS/TestFlight: `.github/workflows/ios-testflight.yml` → `tools/ci/ios-testflight.sh` (macos-15, Xcode 26 zorunlu; `expo prebuild` + xcodebuild). GitHub'da Apple işlemcili Mac kapasitesi dolarsa iş 15 dk kuyrukta bekleyip "not acquired by Runner" ile düşer (gerekçe iş notlarında: check-run annotations); o zaman elle başlatmada `runner: macos-15-intel` seçilir.
  İmza: arşiv otomatik geliştirme imzası (`tools/ci/asc_device.py` gerekirse yer tutucu cihaz kaydeder), dışa aktarma **elle App Store dağıtım imzası** (`tools/ci/asc_sign.py`: geçici sertifika + profil, iş sonunda iptal; kullanıcı onayı 19 Ekim 2026). Xcode bulut imzası "Invalid Signature" verdiği için kullanılmaz.
  Arşivden önce `asc_sign.py prune_dev`, CI'ın birikmiş geliştirme sertifikalarını ("Created via API") iptal eder (kullanıcı onayı 19 Ekim 2026). Xcode'un JS paketleme adımı `.env`'i okumadığı için Supabase değerleri ayrıca ortam değişkeni olarak verilir; derleme başında ve arşivden sonra JS paketinde sunucu adresi denetlenir.
  Secret'lar: `SUPABASE_PUBLISHABLE_KEY`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`, isteğe bağlı `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (RevenueCat `appl_…`; `docs/TESTFLIGHT.md`). Elle başlatma: Actions → iOS (TestFlight) ya da commit mesajında `[ios]`.
- Ödeme: `react-native-purchases` 10.16.x, mağazayla konuşan tek dosya `src/lib/purchases.ts` (RevenueCat `appUserID` = Supabase kullanıcı kimliği, girişte `configure`/`logIn`, çıkışta `logOut`; entitlement `premium`, offering `default`). Anahtar yoksa ödeme "bağlı değil". Web önizlemede `preview/demo-purchases.ts` yerine geçer.
- iPad (3 Kasım 2026): `supportsTablet: true`; iPhone yalnız dikey, iPad dört yön (Expo eklentisi `UISupportedInterfaceOrientations~ipad`'i doldurur). Ekranlar geniş ekranda ortada en çok 720 noktalık sütunda (`src/components/Column.tsx`, gezinmede `screenLayout`); ana sayfa yatayda iki sütun. Pencere/alt sayfa kartları `maxWidth` ile sınırlı. Pencere genişliği yerine sütun genişliği kullan (ör. Görevler'deki hafta şeridi).
- İlk TestFlight yüklemesi: 19 Ekim 2026.
- Durum ve geçmiş: `docs/DURUM.md`.

## Ürün kararları

- İş modeli (19 Ekim 2026): aile aboneliği (ParentApp) + klinik kanalı (ClinicApp). Raporlar iki okuyucuya yazılır: ebeveyn ve uzman. Klinik paylaşım yalnız ebeveyn rızasıyla, geri alınabilir.
- Tasarım dili sade ve işlevsel (lacivert `#0F1B3D`); ClinicApp bunu izler.
- **Benchmark alışkanlığı** (kullanıcı kararı 2 Kasım 2026; ortak CLAUDE.md kural 7): her yeni özellik, çıkarma ya da iyileştirmede (akış, tasarım, metin, arayüz, iş kuralı) önce aynı işi yapan başarılı global uygulamaları araştır; en iyi örnekleri artı/eksileriyle değerlendir, ürünün amacına uyanları kullanıcıya seçenek ve öneri olarak sun, kaynakları yaz. İçerik, karakter ve metin kopyalanmaz; yalnız işleyiş referans alınır.
- **Canlıya alma elle yayın** (kullanıcı kararı 2 Kasım 2026; ortak `CANLIYA_ALMA.md` 2.1): App Store Connect'te "Manually release this version"; Apple onaylayınca sürüm kullanıcının onayıyla yayına alınır. CI yalnız TestFlight'a yükler, mağazaya göndermez.
- Referanslar: Joon iş modeli kanvası https://claude.ai/code/artifact/df7eafa7-1e1e-4014-8a5f-7d88cb985485 · Oyun omurgası analizi https://claude.ai/code/artifact/3c82704c-e120-4d73-ba9f-a7ffdc75eeac
