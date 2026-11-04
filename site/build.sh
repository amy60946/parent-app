#!/usr/bin/env bash
# ParentApp web sitesi (kullanıcı isteği 4 Kasım 2026): tanıtım sayfası (site/public → kök) + web uygulaması (/app/:
# ParentApp'in web derlemesi; giriş, kayıt, kurulum, cihaz bağlama). ClinicApp'teki site + /app düzeniyle aynı.
# Kullanım:
#   bash site/build.sh          → dist-site/  gerçek Supabase (EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_KEY ortamda ya da .env'de;
#                                              yalnız publishable anahtar, sb_secret_/service_role reddedilir)
#   bash site/build.sh --demo   → dist-site/  deneme veritabanı (preview/demo-supabase.ts), gerçek sunucuya bağlanmaz
# Yayın (alan adı alınınca, karar bekliyor): dist-site/ bir statik barındırmaya (ör. Cloudflare Pages) yüklenir;
# _redirects /app/* isteklerini uygulamaya yönlendirir. Supabase › Authentication › URL Configuration: Site URL ve
# Redirect URLs'e https://<alan adı>/app/** eklenir.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist-site"
WORK="${PARENTAPP_SITE_WORK:-${TMPDIR:-/tmp}/parentapp-site}"
DEMO=0; [ "${1:-}" = "--demo" ] && DEMO=1

echo "› Expo web projesi ($WORK)"
PARENTAPP_PREVIEW_WORK="$WORK" PREVIEW_PREPARE_ONLY=1 bash "$ROOT/preview/build.sh"

echo "› Kaynaklar kopyalanıyor"
rm -rf "$WORK/src" "$WORK/App.tsx" "$WORK/assets/avatars" "$WORK/.env"
cp -r "$ROOT/App.tsx" "$ROOT/src" "$WORK/"
mkdir -p "$WORK/assets" && cp -r "$ROOT/assets/." "$WORK/assets/"
if [ "$DEMO" = 1 ]; then
  cp "$ROOT/preview/demo-supabase.ts" "$WORK/src/lib/supabase.ts"
  cp "$ROOT/preview/demo-purchases.ts" "$WORK/src/lib/purchases.ts"
  cp "$ROOT/preview/demo-purchases.ts" "$WORK/src/lib/purchases.web.ts"
else
  [ -f "$ROOT/.env" ] && set -a && . "$ROOT/.env" && set +a
  : "${EXPO_PUBLIC_SUPABASE_URL:?EXPO_PUBLIC_SUPABASE_URL gerekli}" "${EXPO_PUBLIC_SUPABASE_KEY:?EXPO_PUBLIC_SUPABASE_KEY gerekli (publishable)}"
  case "$EXPO_PUBLIC_SUPABASE_KEY" in sb_secret_*|*service_role*) echo "::error::Gizli anahtar web'e konmaz"; exit 1;; esac
  printf 'EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_KEY=%s\n' "$EXPO_PUBLIC_SUPABASE_URL" "$EXPO_PUBLIC_SUPABASE_KEY" > "$WORK/.env"
  rm -f "$WORK/src/lib/purchases.ts"   # web: purchases.web.ts (satın alma uygulamadan)
fi

echo "› Web uygulaması (/app/)"
# app.json geçici değişir (önizleme aynı projeyi kullanabilir): derlemeden sonra geri alınır
cp "$WORK/app.json" "$WORK/app.json.orig"
trap 'mv -f "$WORK/app.json.orig" "$WORK/app.json" 2>/dev/null || true' EXIT
node -e '
  const f = process.argv[1], j = require(f);
  j.expo.name = "ParentApp"; j.expo.experiments = { ...(j.expo.experiments || {}), baseUrl: "/app" };
  j.expo.web = { ...(j.expo.web || {}), output: "single", favicon: "./assets/icon.png" };
  require("fs").writeFileSync(f, JSON.stringify(j, null, 2));' "$WORK/app.json"
rm -rf "$WORK/dist"
(cd "$WORK" && CI=1 npx expo export --platform web --output-dir dist >/dev/null)
grep -q 'lang=' "$WORK/dist/index.html" || sed -i 's/<html/<html lang="tr"/' "$WORK/dist/index.html"

echo "› Site birleştiriliyor ($OUT)"
rm -rf "$OUT" && mkdir -p "$OUT"
cp -r "$ROOT/site/public/." "$OUT/"
# Tanıtım sayfası (site/landing.html, iskeletsiz yazılır: önizlemede Artifact iskeleti ekler) → tam belge
python3 - "$ROOT/site/landing.html" "$OUT/index.html" <<'PY'
import sys
src = open(sys.argv[1], encoding='utf-8').read()
i = src.index('<header')
head, body = src[:i], src[i:]
open(sys.argv[2], 'w', encoding='utf-8').write(
  '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n'
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  '<link rel="icon" href="img/parentapp-simge.png">\n'
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
  + head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n')
PY
cp -r "$WORK/dist" "$OUT/app"
printf '/app/*  /app/index.html  200\n' > "$OUT/_redirects"
cat > "$OUT/_headers" <<'H'
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(self), geolocation=()
  X-Frame-Options: DENY
H
[ "$DEMO" = 1 ] && echo "✓ dist-site/ hazır (DENEME veritabanı)" || echo "✓ dist-site/ hazır (gerçek sunucu)"
