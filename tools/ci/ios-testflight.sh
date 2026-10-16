#!/usr/bin/env bash
# CI (macOS): Expo projesinden yerel iOS projesi üretir (expo prebuild), otomatik imzayla (App Store Connect API anahtarı)
# arşivler ve TestFlight'a yükler. EAS hesabı/sertifika kurulumu gerekmez; Apple sertifika ve profili bulutta yönetir.
# Gerekli: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (p8 metni), APPLE_TEAM_ID, BUILD_NUMBER. Gizli bilgiler loga yazılmaz.
set -euo pipefail
xc=$(ls -d /Applications/Xcode_*.app 2>/dev/null | grep -v -i beta | sort -V | tail -1 || true)
[ -n "$xc" ] && sudo xcode-select -s "$xc/Contents/Developer"
xcodebuild -version

jq --arg b "$BUILD_NUMBER" '.expo.ios.buildNumber = $b' app.json > app.tmp && mv app.tmp app.json
CI=1 npx expo prebuild --platform ios --clean
ws=$(ls -d ios/*.xcworkspace | head -1); scheme=$(basename "$ws" .xcworkspace)
echo "Çalışma alanı: $ws, şema: $scheme"

keydir="$RUNNER_TEMP/asc"; mkdir -p "$keydir"; chmod 700 "$keydir"
key="$keydir/AuthKey_${ASC_KEY_ID}.p8"
# p8 metni nasıl yapıştırılmış olursa olsun (BEGIN/END'li ya da yalnız gövde, \r, boşluk, tek satır, "\n" yazıları) geçerli PEM'e çevrilir
body=$(printf '%s' "$ASC_KEY_P8" | sed 's/\\n/\n/g' | tr -d '\r' | sed -E 's/-----(BEGIN|END) [A-Z ]*KEY-----//g' | tr -d ' \t\n')
[ -n "$body" ] || { echo "::error::ASC_KEY_P8 boş"; exit 1; }
{ echo "-----BEGIN PRIVATE KEY-----"; printf '%s' "$body" | fold -w 64; echo; echo "-----END PRIVATE KEY-----"; } > "$key"
chmod 600 "$key"
openssl pkey -in "$key" -noout 2>/dev/null || echo "::warning::ASC_KEY_P8 geçerli bir özel anahtar gibi görünmüyor (.p8 dosyasının tüm metnini yapıştır)."
auth=(-allowProvisioningUpdates -authenticationKeyPath "$key" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")

# Arşiv imzasız alınır (geliştirme imzası kayıtlı cihaz ister); imzayı dışa aktarma yapar: App Store dağıtım sertifikası
# Apple bulutunda (API anahtarı Admin) ve App Store profili otomatik. Uygulamanın özel yetkisi (entitlement) yok.
archive="$RUNNER_TEMP/ParentApp.xcarchive"
xcodebuild -workspace "$ws" -scheme "$scheme" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$archive" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  -quiet archive
[ -d "$archive" ] || { echo "::error::Arşiv oluşmadı"; exit 1; }

cat > "$RUNNER_TEMP/ExportOptions.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>${APPLE_TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PL
xcodebuild -exportArchive -archivePath "$archive" -exportOptionsPlist "$RUNNER_TEMP/ExportOptions.plist" \
  -exportPath "$RUNNER_TEMP/export" "${auth[@]}"
echo "TestFlight'a yüklendi. App Store Connect işledikten sonra (genelde 10-30 dk) TestFlight sekmesinde görünür."
rm -f "$key"
