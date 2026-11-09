#!/usr/bin/env bash
# ParentApp web önizlemesini üretir: preview/out/index.html (telefon çerçevesi) + app.html (uygulama)
# Deneme veritabanı (preview/demo-supabase.ts) ve mağaza taklidi (preview/demo-purchases.ts) kullanılır; gerçek Supabase'e ve App Store'a bağlanmaz.
# Kullanım: bash preview/build.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${PARENTAPP_PREVIEW_WORK:-${TMPDIR:-/tmp}/parentapp-preview}"

if [ ! -d "$WORK/node_modules/expo-notifications" ]; then
  echo "› Expo projesi hazırlanıyor ($WORK)"
  rm -rf "$WORK"
  npx --yes create-expo-app@latest "$WORK" --template blank-typescript --no-install >/dev/null
  (cd "$WORK" && npm install >/dev/null)
  PKGS=$(cd "$WORK" && node -e '
    const b = require("expo/bundledNativeModules.json");
    const w = ["@react-navigation/native","@react-navigation/bottom-tabs","@react-navigation/native-stack",
      "react-native-screens","react-native-safe-area-context","@react-native-community/datetimepicker",
      "expo-clipboard","@expo/vector-icons","@react-native-async-storage/async-storage","react-native-url-polyfill",
      "expo-linking","expo-image-picker","expo-audio","expo-file-system","react-dom","react-native-web","@expo/metro-runtime",
      "react-native-gesture-handler","react-native-reanimated","react-native-worklets","react-native-svg","expo-notifications"];
    console.log(w.map((x) => x + "@" + (b[x] || "latest")).join(" "))')
  (cd "$WORK" && npm install $PKGS @supabase/supabase-js react-native-draggable-flatlist qrcode-generator >/dev/null)
fi
[ -d "$WORK/node_modules/qrcode-generator" ] || (cd "$WORK" && npm install qrcode-generator >/dev/null)
# site/build.sh aynı Expo projesini kullanır: yalnız hazırlık
[ "${PREVIEW_PREPARE_ONLY:-}" = "1" ] && exit 0

echo "› Kaynaklar kopyalanıyor"
rm -rf "$WORK/src" "$WORK/App.tsx" "$WORK/assets/avatars"
cp -r "$ROOT/App.tsx" "$ROOT/src" "$WORK/"
mkdir -p "$WORK/assets" && cp -r "$ROOT/assets/." "$WORK/assets/"
cp "$ROOT/preview/demo-supabase.ts" "$WORK/src/lib/supabase.ts"
cp "$ROOT/preview/demo-training.ts" "$WORK/src/lib/demo-training.ts"     # ebeveyn eğitimi örnek verisi (ClinicApp kopyası)
cp "$ROOT/preview/demo-behaviors.ts" "$WORK/src/lib/demo-behaviors.ts"   # hedef davranış örnek verisi (ClinicApp kopyası)
# Klinik önizlemesi (uzman + ebeveyn yan yana) için: PREVIEW_SHARED=1 → ClinicApp önizlemesinin depo anahtarı (ClinicApp
# preview/demo-supabase.ts KEY) ve seans verisini ClinicApp kurar. Çıktı yine preview/out/app.html; o sayfaya app.html olarak yüklenir.
if [ "${PREVIEW_SHARED:-}" = "1" ]; then
  CLINIC_KEY="${PREVIEW_SHARED_KEY:-pofi-onizleme-v4}"
  sed -i "s/^const KEY = 'pofi-onizleme-v[0-9]*';/const KEY = '$CLINIC_KEY';/; s/^const SHARED_WITH_CLINIC = false;/const SHARED_WITH_CLINIC = true;/" "$WORK/src/lib/supabase.ts"
  grep -q "const KEY = '$CLINIC_KEY';" "$WORK/src/lib/supabase.ts" && grep -q "SHARED_WITH_CLINIC = true" "$WORK/src/lib/supabase.ts" || { echo "ortak depo ayarı yazılamadı"; exit 1; }
  echo "› Klinik önizlemesiyle ortak depo: $CLINIC_KEY"
fi
cp "$ROOT/preview/demo-purchases.ts" "$WORK/src/lib/purchases.ts"  # mağaza (RevenueCat) taklidi
cp "$ROOT/preview/demo-purchases.ts" "$WORK/src/lib/purchases.web.ts"  # web derlemesi .web.ts'yi seçer

echo "› Tip kontrolü"
(cd "$WORK" && npx tsc --noEmit)

echo "› Web paketi"
rm -rf "$WORK/dist"
(cd "$WORK" && CI=1 npx expo export --platform web --output-dir dist >/dev/null)

echo "› Paketleniyor"
node "$ROOT/preview/pack.js" "$WORK/dist" "$ROOT/preview/frame.html" "$ROOT/preview/out"
echo "✓ preview/out/index.html hazır"
