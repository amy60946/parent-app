# ParentApp açılış görseli: uygulama simgesindeki filiz + güneş işareti ve "ParentApp" yazısı (saydam zemin; lacivert app.json'da).
# Kullanım: python3 tools/brand/splash.py assets/splash-icon.png assets/brand-mark.png  (Inter Display Bold gerekir)
import sys
from PIL import Image, ImageDraw, ImageFont

S = 4  # süper örnekleme
W = H = 1024
GOLD = (233, 178, 43, 255); GREEN = (126, 200, 140, 255); WHITE = (255, 255, 255, 255)

def quad(p0, c, p1, n=48):
    return [((1-t)**2*p0[0] + 2*(1-t)*t*c[0] + t*t*p1[0], (1-t)**2*p0[1] + 2*(1-t)*t*c[1] + t*t*p1[1]) for t in (i/n for i in range(n+1))]

def mark(draw, ox, oy, k):
    # simge koordinatları (1024'lük simge) → tuval
    P = lambda x, y: ((ox + (x - 512) * k) * S, (oy + (y - 512) * k) * S)
    cx, cy, r = P(511, 267) + (51 * k * S,)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD)
    left = [(308, 354), (395, 354)] + quad((395, 354), (505, 380), (512, 506))[1:] + quad((512, 506), (300, 505), (308, 354))[1:]
    right = [(1024 - x, y) for x, y in left]
    for leaf in (left, right):
        draw.polygon([P(x, y) for x, y in leaf], fill=GREEN)
    x0, y0 = P(492, 490); x1, y1 = P(532, 750)
    draw.rectangle([x0, y0, x1, y1], fill=WHITE)
    x0, y0 = P(362, 728); x1, y1 = P(662, 758)
    draw.rounded_rectangle([x0, y0, x1, y1], radius=15 * k * S, fill=WHITE)

def splash(out):
    im = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    mark(d, 512, 430, 0.86)
    font = ImageFont.truetype('/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf', 128 * S)
    text = 'ParentApp'
    bb = d.textbbox((0, 0), text, font=font)
    tw = bb[2] - bb[0]
    d.text(((W * S - tw) / 2 - bb[0], 812 * S), text, font=font, fill=WHITE)
    im.resize((W, H), Image.LANCZOS).save(out)

def mark_only(out, size=512):
    im = Image.new('RGBA', (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = size / 600
    mark(d, size / 2, size / 2 + 20 * k, k)
    im.resize((size, size), Image.LANCZOS).save(out)

if __name__ == '__main__':
    splash(sys.argv[1])
    if len(sys.argv) > 2: mark_only(sys.argv[2])
