# Fidan (ebeveyn uygulaması) — TestFlight

Fidan yalnızca **ebeveyn** uygulamasıdır (16 Ekim 2026): açılış ekranı ebeveyn girişi. Çocuk, ebeveynin ürettiği giriş kodunu
**Pofi Adası** oyununa yazar (ayrı uygulama, depo `amy60946/pofi-adasi`). Sunucu (Supabase), kodlar ve görev akışı değişmedi.

| | Fidan | Pofi Adası |
|---|---|---|
| Kim kullanır | Ebeveyn | Çocuk |
| Bundle ID | `com.fidan.parentapp` | `com.fidan.gameapp` |
| Yön | Dikey | Yatay |
| Derleme | Expo EAS (`.github/workflows/ios-testflight.yml`) | Unity + Xcode (`pofi-adasi/.github/workflows/ios.yml`) |

## Bir kez yapılacaklar

1. developer.apple.com → Certificates, IDs & Profiles → **Identifiers** → **+** → App IDs → App → Bundle ID (Explicit): `com.fidan.parentapp`.
2. appstoreconnect.apple.com → **Apps** → **+** → **New App**: iOS, ad "Fidan" (alınmışsa "Fidan Ebeveyn"), dil Türkçe, Bundle ID `com.fidan.parentapp`, SKU `parentapp`.
   Oluşunca uygulama → **App Information** → **Apple ID** (10 haneli sayı) → `FIDAN_ASC_APP_ID`.
3. expo.dev (amy60946 hesabı) → sağ üst profil → **Account settings** → **Access tokens** → **Create token** → `EXPO_TOKEN`.
4. Bu depoda (amy60946/parent-app) → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Değer |
|---|---|
| `EXPO_TOKEN` | 3. adımdaki token |
| `FIDAN_ASC_APP_ID` | 2. adımdaki Apple ID (sayı) |
| `SUPABASE_PUBLISHABLE_KEY` | Oyun deposundakiyle aynı publishable anahtar (`sb_publishable_…`; asla `sb_secret_`) |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID` | Oyun deposuna eklenenlerin **aynısı** (secret'lar depo başınadır, iki depoya da eklenir) |
| `APPLE_TEAM_TYPE` | (isteğe bağlı) Apple hesabın şirket hesabıysa `COMPANY_OR_ORGANIZATION`; bireyselse ekleme |

5. Actions → **iOS (TestFlight)** → **Run workflow**. EAS bulutta derler (sıra + derleme ~20–40 dk), sonra TestFlight'a gönderir.
6. App Store Connect → Fidan → **TestFlight** → Internal Testing → kendini ekle → iPhone'daki TestFlight uygulamasından yükle.
