#!/usr/bin/env python3
"""Seçilen marka kitinden Moyo (ParentApp) uygulama ve site görsellerini üretir (kullanıcı kararı 13 Kasım 2026:
iki satırlı "mo / yo" icon, koyu zemin + yeşil harf; logo "C Top, ayarlı").

    python3 brand/app_assets.py

Yazdığı dosyalar (depo kökünden):
  assets/icon.png                     1024 × 1024, saydamlıksız (App Store ve iPhone simgesi)
  assets/favicon.png                  48 × 48 (web uygulaması sekme simgesi)
  assets/android-icon-background.png 1024 × 1024 düz lacivert
  assets/android-icon-foreground.png  1024 × 1024 saydam; işaret uyarlanır icon güvenli alanında
  assets/android-icon-monochrome.png  1024 × 1024 saydam, beyaz
  assets/splash-icon.png              1024 × 1024 saydam; ortada "moyo" sözcük logosu (zemin app.json'da #16113A)
  assets/brand-mark.png               saydam "moyo" sözcük logosu (Aile davet et kartı)
  site/public/img/parentapp-simge.png 256 × 256 (tanıtım sitesinde marka, sekme simgesi, mağaza satırı)
Gerekenler: pip install fonttools brotli uharfbuzz cairosvg pillow
"""
import io
import os
import sys

import cairosvg
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import kit  # noqa: E402

LOGO, FAM = kit.SELECTED['logo'], kit.SELECTED['icon']
assert LOGO and FAM, 'Önce kit.py SELECTED: logo ve icon seçilmeli'


def png(svg, w, h=None):
    data = cairosvg.svg2png(bytestring=svg.encode('utf8'), output_width=w, output_height=h or w)
    return Image.open(io.BytesIO(data))


def save(img, rel, rgb=False):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if rgb:
        img = img.convert('RGB')                 # App Store: saydamlık yok
    img.save(path, optimize=True)
    return '%s %s %s' % (rel, img.size, img.mode)


def wordmark_canvas(size, width_frac):
    """Sözcük logo kare saydam tuvalin ortasında, genişliği tuvalin width_frac'ı kadar."""
    svg, w, h = kit.wordmark(LOGO, 'yesil', pad=0.0)
    mark = png(svg, int(size * width_frac), int(size * width_frac * h / w))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(mark, ((size - mark.width) // 2, (size - mark.height) // 2), mark)
    return canvas


def main():
    out = []
    full = kit.icon('moyo', FAM, LOGO)
    out.append(save(png(full, 1024), 'assets/icon.png', rgb=True))
    out.append(save(png(full, 48), 'assets/favicon.png', rgb=True))
    out.append(save(png(full, 256), 'site/public/img/parentapp-simge.png', rgb=True))
    out.append(save(Image.new('RGB', (1024, 1024), kit.C['lacivert']), 'assets/android-icon-background.png'))
    # Uyarlanır icon: görünen alan katmanın ~%67'si; işaret aynı oranda küçülür (iOS simgesindeki görünümü korur)
    out.append(save(png(kit.icon('moyo', FAM, LOGO, transparent=True, frac_scale=0.66), 1024), 'assets/android-icon-foreground.png'))
    out.append(save(png(kit.icon('moyo', FAM, LOGO, transparent=True, frac_scale=0.66, mono='#FFFFFF'), 1024), 'assets/android-icon-monochrome.png'))
    out.append(save(wordmark_canvas(1024, 0.78), 'assets/splash-icon.png'))
    svg, w, h = kit.wordmark(LOGO, 'yesil', pad=0.0)
    out.append(save(png(svg, 360, int(360 * h / w)), 'assets/brand-mark.png'))
    print('\n'.join(out))


if __name__ == '__main__':
    main()
