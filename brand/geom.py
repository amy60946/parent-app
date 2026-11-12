"""Moyo marka kiti: geometri yardımcıları.

Şekil = [(komut, [(x, y), ...])]; komutlar M, L, C (kübik), Z; koordinat y aşağı (SVG), taban çizgisi y = 0, yazı tipi birimi.
Harfler açık lisanslı yazı tipinin (SIL OFL) dış çizgilerinden alınır; "y" kuyruğu burada hesaplanan özgün eğridir.
"""
import io
import math
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
import uharfbuzz as hb


class ShapePen(BasePen):
    def __init__(self, glyphset):
        super().__init__(glyphset)
        self.shape = []

    def _moveTo(self, pt): self.shape.append(('M', [pt]))
    def _lineTo(self, pt): self.shape.append(('L', [pt]))
    def _curveToOne(self, p1, p2, p3): self.shape.append(('C', [p1, p2, p3]))
    def _closePath(self): self.shape.append(('Z', []))
    def _endPath(self): pass


class Face:
    def __init__(self, path):
        self.font = TTFont(path)
        self.gs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upm = self.font['head'].unitsPerEm
        self.xh = self.font['OS/2'].sxHeight
        self.cap = self.font['OS/2'].sCapHeight
        raw = TTFont(path)
        raw.flavor = None                       # HarfBuzz WOFF2 okumaz: düz TTF'e çevir
        buf = io.BytesIO()
        raw.save(buf)
        self.hbfont = hb.Font(hb.Face(buf.getvalue()))

    def name(self, ch):
        return self.cmap[ord(ch)]

    def adv(self, ch):
        return self.font['hmtx'][self.name(ch)][0]

    def glyph(self, glyph_name, dx=0.0, dy=0.0):
        """Glif → şekil (y aşağı)."""
        pen = ShapePen(self.gs)
        self.gs[glyph_name].draw(pen)
        return [(op, [(dx + x, dy - y) for x, y in pts]) for op, pts in pen.shape]

    def stem_right(self, ch='u'):
        """Sağ dikmenin sol ve sağ kenarı (harfin tepesindeki en sağ iki nokta)."""
        pts = [p for _, ps in self.glyph(self.name(ch)) for p in ps]
        top = min(p[1] for p in pts)
        xs = sorted({round(p[0]) for p in pts if abs(p[1] - top) < 0.5})
        return xs[-2], xs[-1]

    def text(self, text, dx=0.0, dy=0.0, tracking=0.0):
        """Metin → (şekil, genişlik); kerning ile."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hbfont, buf, {'kern': True, 'liga': False})
        shape, x = [], 0.0
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            shape += self.glyph(self.font.getGlyphName(info.codepoint), dx + x + pos.x_offset, dy)
            x += pos.x_advance + tracking
        return shape, x - tracking


def move(shape, dx=0.0, dy=0.0, s=1.0):
    return [(op, [(dx + s * x, dy + s * y) for x, y in pts]) for op, pts in shape]


def bounds(*shapes):
    pts = [p for sh in shapes for _, ps in sh for p in ps]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def num(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


def path_d(shape):
    return ''.join(op + ' '.join('%s %s' % (num(x), num(y)) for x, y in pts) for op, pts in shape)


def polygon(points):
    return [('M', [points[0]])] + [('L', [p]) for p in points[1:]] + [('Z', [])]


def circle(cx, cy, r):
    k = 0.5522847498 * r
    return [('M', [(cx + r, cy)]),
            ('C', [(cx + r, cy + k), (cx + k, cy + r), (cx, cy + r)]), ('C', [(cx - k, cy + r), (cx - r, cy + k), (cx - r, cy)]),
            ('C', [(cx - r, cy - k), (cx - k, cy - r), (cx, cy - r)]), ('C', [(cx + k, cy - r), (cx + r, cy - k), (cx + r, cy)]), ('Z', [])]


def turtle(start, heading_deg, segs, step_deg=3.0, step_len=8.0):
    """Çizgi ve yay parçalarından merkez çizgisi (y aşağı; yön 90° = aşağı, 180° = sol, 270° = yukarı).
    segs: ('L', uzunluk) | ('A', yarıçap, açı°); açı + ise ekranda saat yönünde döner. Dönüş: [(x, y, yön°, baştan uzunluk)]."""
    x, y = start
    h, s = heading_deg, 0.0
    pts = [(x, y, h, s)]
    for seg in segs:
        if seg[0] == 'L':
            k = max(1, int(seg[1] / step_len))
            for _ in range(k):
                d = seg[1] / k
                x += d * math.cos(math.radians(h)); y += d * math.sin(math.radians(h)); s += d
                pts.append((x, y, h, s))
        else:
            _, r, ang = seg
            sg = 1.0 if ang > 0 else -1.0
            k = max(2, int(abs(ang) / step_deg))
            cx = x + r * math.cos(math.radians(h + 90 * sg)); cy = y + r * math.sin(math.radians(h + 90 * sg))
            a0 = math.atan2(y - cy, x - cx)
            h0, s0 = h, s
            for i in range(1, k + 1):
                da = math.radians(abs(ang) * i / k) * sg
                pts.append((cx + r * math.cos(a0 + da), cy + r * math.sin(a0 + da), h0 + math.degrees(da), s0 + r * abs(da)))
            x, y, h, s = pts[-1]
    return pts


def ribbon(pts, width, taper_from=1.0, end_ratio=1.0, cap=True):
    """Merkez çizgisi → dolu şerit. Genişlik, uzunluğun taper_from oranından sonra uca doğru end_ratio katına iner; uç yuvarlak."""
    total = pts[-1][3] or 1.0
    def w(s):
        t = s / total
        if t <= taper_from or taper_from >= 1.0:
            return width
        k = (t - taper_from) / (1 - taper_from)
        k = k * k * (3 - 2 * k)
        return width * (1 - (1 - end_ratio) * k)
    left, right = [], []
    for x, y, h, s in pts:
        nx, ny = math.cos(math.radians(h - 90)), math.sin(math.radians(h - 90))
        hw = w(s) / 2
        left.append((x + nx * hw, y + ny * hw)); right.append((x - nx * hw, y - ny * hw))
    poly = left[:]
    if cap:
        x, y, h, s = pts[-1]
        hw = w(s) / 2
        for i in range(1, 14):
            a = math.radians(h - 90 + 180 * i / 14)
            poly.append((x + hw * math.cos(a), y + hw * math.sin(a)))
    return polygon(poly + right[::-1])
