# ParentApp (ebeveyn uygulaması) — TestFlight

ParentApp yalnızca **ebeveyn** uygulamasıdır (16 Ekim 2026): açılış ekranı ebeveyn girişi. Çocuk, ebeveynin ürettiği giriş kodunu
**Pofi Adası** oyununa yazar (ayrı uygulama, depo `amy60946/pofi-adasi`). Sunucu (Supabase), kodlar ve görev akışı değişmedi.

| | ParentApp | Pofi Adası |
|---|---|---|
| Kim kullanır | Ebeveyn | Çocuk |
| Bundle ID | `com.parentapp.ios` | `com.gameapp.ios` |
| Yön | Dikey | Yatay |
| Derleme | macOS'ta expo prebuild + Xcode (`.github/workflows/ios-testflight.yml`, `tools/ci/ios-testflight.sh`) | Unity + Xcode (`pofi-adasi/.github/workflows/ios.yml`) |

## Bir kez yapılacaklar

1. developer.apple.com → Certificates, IDs & Profiles → **Identifiers** → **+** → App IDs → App → Bundle ID (Explicit): `com.parentapp.ios`.
2. appstoreconnect.apple.com → **Apps** → **+** → **New App**: iOS, ad "ParentApp", dil Türkçe, Bundle ID `com.parentapp.ios`, SKU `parentapp`.
   Oluşunca uygulama → **App Information** → **Apple ID** (10 haneli sayı) → `PARENTAPP_ASC_APP_ID`.
3. (Artık gerekmiyor) Derleme Expo hesabı olmadan GitHub'ın Mac makinesinde yapılır; `EXPO_TOKEN` kullanılmaz.
4. Bu depoda (amy60946/parent-app) → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Değer |
|---|---|
| `PARENTAPP_ASC_APP_ID` | (isteğe bağlı, şu an kullanılmıyor) 2. adımdaki Apple ID |
| `SUPABASE_PUBLISHABLE_KEY` | Oyun deposundakiyle aynı publishable anahtar (`sb_publishable_…`; asla `sb_secret_`) |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID` | Oyun deposuna eklenenlerin **aynısı** (secret'lar depo başınadır, iki depoya da eklenir) |

5. Supabase → Authentication → **URL Configuration**: Site URL `parentapp://`, Redirect URLs'e `parentapp://**` ekle (eski adla girilmiş olanı sil). Şifre yenileme e-postasındaki bağlantı uygulamayı bu adla açar.
6. Actions → **iOS (TestFlight)** → **Run workflow**. GitHub'ın Mac makinesi derler, Apple sertifika/profili otomatik oluşturur (API anahtarı Admin olmalı) ve TestFlight'a yükler (~20–30 dk).
7. App Store Connect → ParentApp → **TestFlight** → Internal Testing → kendini ekle → iPhone'daki TestFlight uygulamasından yükle.
