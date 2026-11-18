#!/usr/bin/env python3
"""Moyo (ParentApp) uygulama görselleri, marka setinden (kullanıcı kararı 18 Kasım 2026: "%60 ve 6 ile ilerle, seti üret,
ürünlere (web app) ve app ikonlarına uygula"; set Marketing penceresinde üretildi: marketing marka/moyo-set-2026-11-18).

Kaynak: brand/svg/moyo/ (yazı "moyo" seçenek 6; işaret 1E yalnız simgede ve profil resminde, yazıyla yan yana kullanılmaz).
Oranlar (işaret genişliği / kare): iOS ve site simgesi %60, Android uyarlanır ön plan %46, tarayıcı sekmesi %68 (köşe yuvarlak).
Renk: simge lacivert #16113A zemin + yeşil #0FD354 işaret; yazı koyu zeminde beyaz (açılış, davet kartı).

    python3 brand/app_assets.py

Yazdığı dosyalar (depo kökünden):
  assets/icon.png                     1024 × 1024, saydamlıksız (App Store ve iPhone simgesi)
  assets/favicon.png                  48 × 48 (web uygulaması sekme simgesi, köşesi yuvarlak)
  assets/android-icon-background.png  1024 × 1024 düz lacivert
  assets/android-icon-foreground.png  1024 × 1024 saydam, yeşil işaret %46
  assets/android-icon-monochrome.png  1024 × 1024 saydam, beyaz işaret %46
  assets/splash-icon.png              1024 × 1024 saydam; beyaz "moyo" tuvalin %64'ü (zemin app.json'da #16113A)
  assets/brand-mark.png               360 × 132 saydam, beyaz "moyo" (Aile davet et kartı)
  site/public/img/parentapp-simge.png 256 × 256 (tanıtım sitesi; sitenin geri kalanı Moyo Mercek penceresinde)
Depodaki PNG'ler Marketing setinin piksel denetiminden geçmiş dosyalarıdır (birebir kopya); bu betik aynı SVG'lerden üretir,
fark yalnız kenar yumuşatmasındadır (%0,4'ten az piksel).
Gerekenler: pip install cairosvg pillow
"""
import io
import os

import cairosvg
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SET = os.path.join(HERE, 'svg', 'moyo')
LAC = '#16113A'


def svg(name):
    return open(os.path.join(SET, name), encoding='utf-8').read()


def png(text, w, h=None):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=text.encode('utf-8'), output_width=w, output_height=h or w))).convert('RGBA')


def flat(im):
    bg = Image.new('RGB', im.size, LAC)
    bg.paste(im, mask=im.split()[3])
    return bg


def save(img, rel):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    return '%s %s %s' % (rel, img.size, img.mode)


def wordmark_on_canvas(size, width_pct):
    """Beyaz yazı kare saydam tuvalin ortasında, genişliği tuvalin width_pct'i kadar."""
    t = svg('moyo-yazi-beyaz.svg')
    vb = [float(v) for v in t.split('viewBox="', 1)[1].split('"', 1)[0].split()]
    w = size * width_pct / 100.0
    h = w * vb[3] / vb[2]
    mark = png(t, round(w), round(h))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return canvas


def main():
    out = [
        save(flat(png(svg('moyo-simge-1024.svg'), 1024)), 'assets/icon.png'),
        save(png(svg('moyo-favicon.svg'), 48), 'assets/favicon.png'),
        save(Image.new('RGB', (1024, 1024), LAC), 'assets/android-icon-background.png'),
        save(png(svg('moyo-android-on-plan.svg'), 1024), 'assets/android-icon-foreground.png'),
        save(png(svg('moyo-android-tek-renk.svg'), 1024), 'assets/android-icon-monochrome.png'),
        save(wordmark_on_canvas(1024, 64), 'assets/splash-icon.png'),
        save(png(svg('moyo-yazi-beyaz.svg'), 360, 132), 'assets/brand-mark.png'),
        save(flat(png(svg('moyo-simge-1024.svg'), 256)), 'site/public/img/parentapp-simge.png'),
    ]
    print('\n'.join(out))


if __name__ == '__main__':
    main()
