# "A · Döngü" panoramasını 7 kareye böler: saydamlık yok (RGB), tam boyut denetimi, yarım boyutlu önizleme JPEG.
# Girdi: store/out/dongu/panorama-<iphone|ipad>.png (render.js). Çıktı: store/out/dongu/<cihaz>/01–07.png, onizleme/<cihaz>_01–07.jpg
# Kullanım: python3 store/dongu/slice.py [iphone ipad]
import os, sys
from PIL import Image
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'dongu')
SIZE = {'iphone': (1206, 2622), 'ipad': (2064, 2752)}  # Apple: iPhone 6.3", iPad 13"
N = 7
os.makedirs(os.path.join(OUT, 'onizleme'), exist_ok=True)
for dev in (sys.argv[1:] or ['iphone', 'ipad']):
    w, h = SIZE[dev]
    pano = Image.open(os.path.join(OUT, f'panorama-{dev}.png')).convert('RGB')
    assert pano.size == (w * N, h), (dev, pano.size)
    os.makedirs(os.path.join(OUT, dev), exist_ok=True)
    for i in range(N):
        im = pano.crop((i * w, 0, (i + 1) * w, h))
        f = os.path.join(OUT, dev, f'{i + 1:02d}.png')
        im.save(f, optimize=True)
        chk = Image.open(f)
        assert chk.size == (w, h) and chk.mode == 'RGB', (f, chk.size, chk.mode)
        im.resize((w // 2, h // 2), Image.LANCZOS).save(os.path.join(OUT, 'onizleme', f'{dev}_{i + 1:02d}.jpg'), quality=84)
    print('✓', dev, f'{N} kare {w}x{h} RGB')
