#!/usr/bin/env bash
# App Store görselleri, "A · Döngü" tasarımı: gerçek ekranlar → panorama → 7 kare (iPhone 6.3" ve iPad 13").
# Kullanım: bash store/dongu/build.sh   (önce: bash preview/build.sh)
# Çıktı (depoya girmez): store/out/dongu/iphone/01–07.png (1206x2622), ipad/01–07.png (2064x2752), onizleme/*.jpg
# render.js kart kurallarını denetler (kart metni ekranda var mı, kart hiçbir öğeyi yarım kapatmıyor mu, ekranlar aynı hizada mı); biri bozulursa derleme durur.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/../out"
[ -f "$DIR/../../preview/out/app.html" ] || { echo "Önce: bash preview/build.sh"; exit 1; }
mkdir -p "$OUT/fonts"
# Başlık yazısı Poppins 600/700/800 (latin + latin-ext: ı ğ ş İ için), npm'den
if [ ! -f "$OUT/fonts/poppins-latin-ext-800-normal.woff2" ]; then
  T=$(mktemp -d); (cd "$T" && npm pack @fontsource/poppins@5.2.5 >/dev/null && tar xzf fontsource-poppins-5.2.5.tgz)
  for w in 600 700 800; do cp "$T"/package/files/poppins-latin{,-ext}-$w-normal.woff2 "$OUT/fonts/"; done
  rm -rf "$T"
fi
fc-list : family | grep "Inter" >/dev/null || { echo "Inter yazı tipi kurulu değil (metin ve uygulama ekranları Inter ile)"; exit 1; }
echo "› Gerçek ekranlar (deneme verisi, kurgusal adlar)"; node "$DIR/capture.js"
echo "› Panorama";                                    node "$DIR/render.js"
echo "› Kareler";                                     python3 "$DIR/slice.py"
echo "✓ store/out/dongu/: iphone/01–07.png, ipad/01–07.png, onizleme/"
