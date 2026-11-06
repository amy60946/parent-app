# Ekran görüntülerini App Store'a uygun hâle getirir: saydamlık yok (RGB), 6.9" 1320x2868 + 6.3" 1206x2622, önizleme JPEG.
# Kullanım: python3 store/slice.py [A B C]
import sys, glob, os
from PIL import Image
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
for name in (sys.argv[1:] or ['A', 'B', 'C']):
    for f in sorted(glob.glob(os.path.join(OUT, name, '[0-9][0-9].png'))):
        n = os.path.basename(f)[:2]
        im = Image.open(f).convert('RGB')
        assert im.size == (1320, 2868), (f, im.size)
        im.save(f, optimize=True)
        im.resize((1206, 2622), Image.LANCZOS).save(os.path.join(OUT, name, f'{n}_6.3.png'), optimize=True)
        im.resize((660, 1434), Image.LANCZOS).save(os.path.join(OUT, name, f'{n}_onizleme.jpg'), quality=84)
    print('✓', name)
