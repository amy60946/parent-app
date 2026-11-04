#!/usr/bin/env bash
# App Store ekran görüntüleri: önizleme derlemesi → gerçek ekranlar → üç tasarım → boyutlar.
# Kullanım: bash store/build.sh [A B C]   (önce: bash preview/build.sh)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
[ -f "$DIR/../preview/out/app.html" ] || { echo "Önce: bash preview/build.sh"; exit 1; }
mkdir -p "$DIR/out/fonts"
if [ ! -f "$DIR/out/fonts/source-serif-4-latin-ext-600-normal.woff2" ]; then
  T=$(mktemp -d); (cd "$T" && npm pack @fontsource/source-serif-4@5.2.5 >/dev/null && tar xzf fontsource-source-serif-4-5.2.5.tgz)
  cp "$T"/package/files/source-serif-4-latin{,-ext}-600-normal.woff2 "$DIR/out/fonts/"; rm -rf "$T"
fi
fc-list | grep -q "Inter Display" || echo "Uyarı: Inter / Inter Display yazı tipi kurulu değil; başlıklar yedek yazı tipiyle çıkar."
echo "› Gerçek ekranlar (deneme verisi, kurgusal adlar)"; node "$DIR/capture/capture.js"
echo "› Tasarımlar"; node "$DIR/render.js" "$@"
echo "› Boyutlar"; python3 "$DIR/slice.py" "$@"
echo "✓ store/out/<A|B|C>/: NN.png (6.9\"), NN_6.3.png, NN_onizleme.jpg"
