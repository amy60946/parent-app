#!/usr/bin/env bash
# Fidan web önizlemesini üretir: preview/out/index.html (telefon çerçevesi) + app.html (uygulama)
# Deneme veritabanı (preview/demo-supabase.ts) kullanılır; gerçek Supabase'e bağlanmaz.
# Kullanım: bash preview/build.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${FIDAN_PREVIEW_WORK:-${TMPDIR:-/tmp}/fidan-preview}"

if [ ! -d "$WORK/node_modules/react-native-draggable-flatlist" ]; then
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
      "react-native-gesture-handler","react-native-reanimated","react-native-worklets","react-native-svg"];
    console.log(w.map((x) => x + "@" + (b[x] || "latest")).join(" "))')
  (cd "$WORK" && npm install $PKGS @supabase/supabase-js react-native-draggable-flatlist >/dev/null)
fi

echo "› Kaynaklar kopyalanıyor"
rm -rf "$WORK/src" "$WORK/App.tsx" "$WORK/assets/avatars"
cp -r "$ROOT/App.tsx" "$ROOT/src" "$WORK/"
mkdir -p "$WORK/assets" && cp -r "$ROOT/assets/." "$WORK/assets/"
cp "$ROOT/preview/demo-supabase.ts" "$WORK/src/lib/supabase.ts"

echo "› Tip kontrolü"
(cd "$WORK" && npx tsc --noEmit)

echo "› Web paketi"
rm -rf "$WORK/dist"
(cd "$WORK" && CI=1 npx expo export --platform web --output-dir dist >/dev/null)

echo "› Paketleniyor"
node "$ROOT/preview/pack.js" "$WORK/dist" "$ROOT/preview/frame.html" "$ROOT/preview/out"
echo "✓ preview/out/index.html hazır"
