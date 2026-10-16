#!/usr/bin/env bash
# CI (macOS): Expo projesinden yerel iOS projesi üretir (expo prebuild), otomatik imzayla (App Store Connect API anahtarı)
# arşivler ve TestFlight'a yükler. EAS hesabı/sertifika kurulumu gerekmez; Apple sertifika ve profili bulutta yönetir.
# Gerekli: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (p8 metni), APPLE_TEAM_ID, BUILD_NUMBER. Gizli bilgiler loga yazılmaz.
set -euo pipefail
# App Store yüklemesi iOS 26 SDK (Xcode 26+) ister: kurulu en yeni kararlı Xcode seçilir
xc=$(ls -d /Applications/Xcode_*.app 2>/dev/null | grep -v -i beta | sort -V | tail -1 || true)
[ -n "$xc" ] && sudo xcode-select -s "$xc/Contents/Developer"
v=$(xcodebuild -version | head -1 | awk '{print $2}' | cut -d. -f1)
[ "${v:-0}" -ge 26 ] || { echo "::error::Xcode $v kurulu; App Store Xcode 26+ istiyor (runs-on: macos-26)"; exit 1; }
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

# Arşiv otomatik geliştirme imzasıyla alınır (en az bir kayıtlı cihaz gerekir → asc_device.py); dışa aktarma App Store
# dağıtım imzasıyla yeniden imzalar (sertifika Apple bulutunda, API anahtarı Admin).
# Apple ara sertifikaları (WWDR G3/G6): imza zincirinin tamamı gömülsün, yoksa App Store "Invalid Signature" der
for c in AppleWWDRCAG3 AppleWWDRCAG6; do
  curl -fsSL -o "$RUNNER_TEMP/$c.cer" "https://www.apple.com/certificateauthority/$c.cer" \
    && security import "$RUNNER_TEMP/$c.cer" -k ~/Library/Keychains/login.keychain-db -A >/dev/null 2>&1 || true
done
python3 -m pip install -q --disable-pip-version-check "pyjwt[crypto]" 2>/dev/null || python3 -m pip install -q --break-system-packages "pyjwt[crypto]"
python3 "$(dirname "$0")/asc_device.py" "$key"
archive="$RUNNER_TEMP/ParentApp.xcarchive"
xcodebuild -workspace "$ws" -scheme "$scheme" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$archive" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic \
  "${auth[@]}" -quiet archive
[ -d "$archive" ] || { echo "::error::Arşiv oluşmadı"; exit 1; }
codesign -dvv "$(ls -d "$archive"/Products/Applications/*.app | head -1)" 2>&1 | grep -E "Authority|TeamIdentifier" || true

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
