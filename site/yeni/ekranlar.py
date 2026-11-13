#!/usr/bin/env python3
"""Tanıtım sayfasındaki gerçek Moyo ekranları (kullanıcı isteği 13 Kasım 2026: "gerçek ekran görselleri olsun").

Ekranlar uygulamanın web önizlemesinden (deneme verisi, adlar kurgusal) çekilir, küçültülüp site/yeni/img/'ye yazılır:
    bash preview/build.sh
    STORE_REAL=<geçici klasör> node store/capture/capture.js site/yeni/ekranlar.json
    python3 site/yeni/ekranlar.py <geçici klasör>
Çıktı: img/ekran-<ad>.jpg (600 px genişlik) ve img/ekranlar.json (dokunma noktaları yüzde olarak, üst kenar rengi).
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1]
OUT = os.path.join(HERE, 'img')
os.makedirs(OUT, exist_ok=True)
VW, VH = 440.0, 868.0                     # capture.js görüntü alanı (nokta)
meta = json.load(open(os.path.join(SRC, 'meta.json'), encoding='utf-8'))
info = {}
for name in ('onay', 'bugun', 'maceralar', 'ekle', 'odul', 'gelisim'):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGB')
    top = '#%02X%02X%02X' % im.getpixel((im.width // 2, 2))
    small = im.resize((600, round(600 * im.height / im.width)), Image.LANCZOS)
    small.save(os.path.join(OUT, 'ekran-%s.jpg' % name), quality=82, optimize=True, progressive=True)
    entry = {'dosya': 'ekran-%s.jpg' % name, 'ust_renk': top}
    for k, b in (meta.get(name, {}).get('boxes') or {}).items():
        if b:
            entry[k] = {'cx': round(100 * (b['x'] + b['width'] / 2) / VW, 2), 'cy': round(100 * (b['y'] + b['height'] / 2) / VH, 2)}
    info[name] = entry
json.dump(info, open(os.path.join(OUT, 'ekranlar.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(info, ensure_ascii=False))
