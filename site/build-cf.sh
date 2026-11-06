#!/usr/bin/env bash
# Cloudflare yayını (kullanıcı kararı 6 Kasım 2026; ortak DURUM 6 Kasım, CANLIYA_ALMA 1.2). İki ayrı Worker, yalnız statik dosya:
#   bash site/build-cf.sh site      → dist-site/     Worker moyo-site     (moyoapp.com.tr kökü: tanıtım, /img/*, /d/*, AASA)
#   bash site/build-cf.sh ebeveyn   → dist-ebeveyn/  Worker moyo-ebeveyn  (ebeveyn.moyoapp.com.tr: ParentApp web, taban yol /)
# Yayın: npx wrangler@4 deploy -c wrangler.site.jsonc  /  -c wrangler.ebeveyn.jsonc (workers_dev ve preview_urls kapalı; route'ları
# yönetim paneli penceresi bağlar). /destek ve /yasal/* bu sitede değil, aynı alan adında yönetim panelinin Worker'ında.
# Gerekli değişkenler:
#   site:    APPLE_TEAM_ID (10 karakter; Apple Developer › Membership details › Team ID; gizli değil, AASA dosyasında herkese açık)
#   ebeveyn: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY (yalnız publishable anahtar; sb_secret_/service_role reddedilir)
# Önizleme ve eski tek parça düzen için site/build.sh duruyor (kök + /app/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EBEVEYN_URL="${EBEVEYN_URL:-https://ebeveyn.moyoapp.com.tr/}"
BUNDLE_ID="com.parentapp.ios"
SEC='/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY'

case "${1:-}" in
site)
  TEAM="${APPLE_TEAM_ID:-}"
  [[ "$TEAM" =~ ^[A-Z0-9]{10}$ ]] || { echo "APPLE_TEAM_ID eksik ya da hatalı (10 karakter, büyük harf/rakam). Cloudflare › Settings › Build › Variables"; exit 1; }
  OUT="$ROOT/dist-site"; rm -rf "$OUT"; mkdir -p "$OUT/d" "$OUT/.well-known"
  cp -r "$ROOT/site/public/." "$OUT/"
  cp "$ROOT/site/d/index.html" "$OUT/d/index.html"
  # Tanıtım sayfası (iskeletsiz yazılır) → tam belge; giriş/kayıt ebeveyn adresine, destek ve yasal kök yoluna
  python3 - "$ROOT/site/landing.html" "$OUT/index.html" "$EBEVEYN_URL" <<'PY'
import sys
src, out, app = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(src, encoding='utf-8').read()
s = s.replace('href="app/index.html#', f'href="{app}#').replace('href="yasal/', 'href="/yasal/').replace('href="destek"', 'href="/destek"')
assert 'app/index.html' not in s, 'tanıtım sayfasında eski /app/ bağlantısı kaldı'
i = s.index('<header')
open(out, 'w', encoding='utf-8').write(
  '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n'
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  '<link rel="icon" href="/img/parentapp-simge.png">\n'
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
  + s[:i] + '</head>\n<body>\n' + s[i:] + '\n</body>\n</html>\n')
PY
  # Universal Links: uzman → aile daveti uygulamada açılsın (uzantısız, yönlendirmesiz, application/json)
  printf '{\n  "applinks": {\n    "details": [\n      { "appIDs": ["%s.%s"], "components": [{ "/": "/d/*", "comment": "Uzman aile daveti" }] }\n    ]\n  }\n}\n' "$TEAM" "$BUNDLE_ID" > "$OUT/.well-known/apple-app-site-association"
  printf '/d/*  /d/index.html  200\n' > "$OUT/_redirects"
  printf '%s\n\n/.well-known/apple-app-site-association\n  Content-Type: application/json\n  Cache-Control: max-age=3600\n' "$SEC" > "$OUT/_headers"
  echo "✓ dist-site/ hazır (AASA: $TEAM.$BUNDLE_ID)";;
ebeveyn)
  : "${EXPO_PUBLIC_SUPABASE_URL:?EXPO_PUBLIC_SUPABASE_URL gerekli}" "${EXPO_PUBLIC_SUPABASE_KEY:?EXPO_PUBLIC_SUPABASE_KEY gerekli (publishable)}"
  case "$EXPO_PUBLIC_SUPABASE_KEY" in sb_secret_*|*service_role*) echo "Gizli anahtar web derlemesine girmez; yalnız publishable anahtar"; exit 1;; esac
  OUT="$ROOT/dist-ebeveyn"; rm -rf "$OUT"
  (cd "$ROOT" && CI=1 npx expo export --platform web --output-dir dist-ebeveyn > /dev/null)
  sed -i -E 's/<html lang="[^"]*"/<html/; s/<html/<html lang="tr"/' "$OUT/index.html"   # Expo lang="en" yazar
  grep -q "$(echo "$EXPO_PUBLIC_SUPABASE_URL" | sed 's#https://##')" -r "$OUT/_expo" || { echo "Derlemede Supabase adresi yok"; exit 1; }
  printf '%s\n  Permissions-Policy: camera=(self), microphone=(self), geolocation=()\n' "$SEC" > "$OUT/_headers"
  echo "✓ dist-ebeveyn/ hazır";;
*) echo "kullanım: bash site/build-cf.sh site|ebeveyn"; exit 2;;
esac
