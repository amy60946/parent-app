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
- iOS/TestFlight: `.github/workflows/ios-testflight.yml` → `tools/ci/ios-testflight.sh` (macos-15, Xcode 26 zorunlu; `expo prebuild` + xcodebuild).
  İmza: arşiv otomatik geliştirme imzası (`tools/ci/asc_device.py` gerekirse yer tutucu cihaz kaydeder), dışa aktarma **elle App Store dağıtım imzası** (`tools/ci/asc_sign.py`: geçici sertifika + profil, iş sonunda iptal; kullanıcı onayı 19 Ekim 2026). Xcode bulut imzası "Invalid Signature" verdiği için kullanılmaz.
  Secret'lar: `SUPABASE_PUBLISHABLE_KEY`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID` (`docs/TESTFLIGHT.md`). Elle başlatma: Actions → iOS (TestFlight) ya da commit mesajında `[ios]`.
- İlk TestFlight yüklemesi: 19 Ekim 2026.
- Durum ve geçmiş: `docs/DURUM.md`.

## Ürün kararları

- İş modeli (19 Ekim 2026): aile aboneliği (ParentApp) + klinik kanalı (ClinicApp). Raporlar iki okuyucuya yazılır: ebeveyn ve uzman. Klinik paylaşım yalnız ebeveyn rızasıyla, geri alınabilir.
- Tasarım dili sade ve işlevsel (lacivert `#0F1B3D`); ClinicApp bunu izler.
- Referanslar: Joon iş modeli kanvası https://claude.ai/code/artifact/df7eafa7-1e1e-4014-8a5f-7d88cb985485 · Oyun omurgası analizi https://claude.ai/code/artifact/3c82704c-e120-4d73-ba9f-a7ffdc75eeac
