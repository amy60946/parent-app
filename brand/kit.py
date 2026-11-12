"""Moyo marka kiti: renkler, sözcük logo, "Mercek" kilidi, uygulama iconları. Çalıştırma: python3 brand/build.py

Sözcük logo küçük harf "moyo". m ve o harfleri Poppins ExtraBold (SIL OFL) dış çizgileri; "y" özgün: "u" gövdesi + kuyruk.
Üç alternatif: A Kıvrım (kuyruk içe kıvrılır) · B Gülüş (kuyruk sola uzanıp yükselir) · C Top (kısa kanca + ayrı duran top).
"""
import math
import os
from geom import Face, move, bounds, num, path_d, circle, turtle, ribbon

HERE = os.path.dirname(os.path.abspath(__file__))
HEAVY = Face(os.path.join(HERE, 'fonts', 'poppins-latin-800-normal.woff2'))
LIGHT = Face(os.path.join(HERE, 'fonts', 'poppins-latin-300-normal.woff2'))
X = float(HEAVY.xh)
_a, _b = HEAVY.stem_right('u')
S = float(_b - _a)                 # dikme kalınlığı
XC = (_a + _b) / 2.0               # "u"nun sağ dikmesinin ekseni
TRACK = -0.014 * HEAVY.upm

VARIANTS = {'a': 'Kıvrım', 'b': 'Gülüş', 'c': 'Top'}
FAMILIES = {'1': 'Sözcük', '2': 'y işareti', '3': 'İki satır'}

# Renkler: kullanıcının verdiği referans temel alındı (lacivert zemin, tek yeşil vurgu, gri basamaklar).
PALETTE = [
    ('Lacivert', 'lacivert', '#16113A', 'Koyu zemin; açık zeminde yazı ve logo'),
    ('Lacivert 2', 'lacivert-2', '#2D294E', 'Koyu zeminde kart, yükseltilmiş alan'),
    ('Gece', 'gece', '#0E0B26', 'En koyu zemin, alt bilgi'),
    ('Yeşil', 'yesil', '#51E56A', 'Ana düğme zemini (üstünde lacivert yazı), vurgu'),
    ('Marka yeşili', 'yesil-marka', '#0FD354', 'Koyu zeminde logo; açık zeminde yalnız dolgu'),
    ('Camgöbeği', 'camgobegi', '#00D1FF', 'İkincil vurgu (rozet, grafik)'),
    ('Beyaz', 'beyaz', '#FFFFFF', 'Açık zemin; koyu zeminde yazı'),
    ('Sis', 'sis', '#F8F8F9', 'Bölüm zemini'),
    ('Çizgi', 'cizgi', '#E8E7EB', 'Ayırıcı, kart kenarı'),
    ('Soluk', 'soluk', '#D0CFD8', 'Pasif alan'),
    ('Yazı 2', 'yazi-2', '#5C5875', 'İkincil yazı (açık zeminde)'),
    ('Yazı 3', 'yazi-3', '#737089', 'Açıklama yazısı'),
]
C = {var: val for _, var, val, _ in PALETTE}
INKS = {'lacivert': (C['lacivert'], C['yesil-marka']), 'yesil': (C['yesil-marka'], C['beyaz']), 'beyaz': (C['beyaz'], C['yesil'])}
PRODUCTS = {
    'moyo': {'ad': 'Moyo', 'bg': C['lacivert'], 'fg': C['yesil'], 'accent': C['beyaz']},
    'mercek': {'ad': 'Moyo Mercek', 'bg': C['beyaz'], 'fg': C['lacivert'], 'accent': C['yesil-marka']},
    'oyun': {'ad': 'Moyo Oyun', 'bg': C['yesil'], 'fg': C['lacivert'], 'accent': C['beyaz']},
}


def tail(variant):
    """"y" kuyruğu ("u" glifinin yerinde; y aşağı). Dönüş: (şekil, top şekli ya da None)."""
    start = (XC, -0.45 * X)
    if variant == 'a':          # aşağı in, sola dön, yukarı çık, içe kıvrıl; uca doğru incelir
        pts = turtle(start, 90, [('L', 0.45 * X + 0.46 * X), ('A', 0.40 * X, 180), ('A', 0.225 * X, 200)])
        return ribbon(pts, S, taper_from=0.52, end_ratio=0.66), None
    if variant == 'b':          # aşağı in, geniş yayla sola uzan, hafifçe yüksel
        pts = turtle(start, 90, [('L', 0.45 * X + 0.30 * X), ('A', 0.40 * X, 78), ('A', 2.1 * X, 34)])
        return ribbon(pts, S, taper_from=0.45, end_ratio=0.62), None
    if variant == 'c':          # kısa kanca; ucunun ilerisinde ayrı duran top
        pts = turtle(start, 90, [('L', 0.45 * X + 0.34 * X), ('A', 0.36 * X, 118)])
        x, y, h, _ = pts[-1]
        r = 0.205 * X
        gap = 0.42 * S + 0.13 * X + r
        return ribbon(pts, S, taper_from=0.55, end_ratio=0.84), circle(x + gap * math.cos(math.radians(h)), y + gap * math.sin(math.radians(h)), r)
    raise ValueError(variant)


def letter(ch, variant):
    """Tek harf: (harf şekli, vurgu şekli, ilerleme)."""
    if ch != 'y':
        return HEAVY.glyph(HEAVY.name(ch)), [], HEAVY.adv(ch)
    t, ball = tail(variant)
    return HEAVY.glyph(HEAVY.name('u')) + t, ball or [], HEAVY.adv('u')


def word(text, variant, dx=0.0, dy=0.0):
    """Harf dizisi → (harf şekli, vurgu şekli, genişlik, harf başlangıçları)."""
    ink, acc, x, starts = [], [], 0.0, []
    for ch in text:
        g, a, adv = letter(ch, variant)
        starts.append(dx + x)
        ink += move(g, dx + x, dy); acc += move(a, dx + x, dy)
        x += adv + TRACK
    return ink, acc, x - TRACK, starts


def svg_doc(x0, y0, w, h, body, title):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s" role="img" aria-label="%s"><title>%s</title>%s</svg>\n'
            % (num(x0), num(y0), num(w), num(h), title, title, body))


def fill(shape, color):
    return '<path fill="%s" d="%s"/>' % (color, path_d(shape)) if shape else ''


def wordmark(variant, ink='lacivert', suffix=None, pad=0.14):
    """Sözcük logo; suffix 'mercek' ya da 'oyun' ise yanında ince yazıyla kilit. Dönüş: (svg, genişlik, yükseklik)."""
    fg, accent = INKS[ink]
    w_ink, w_acc, width, _ = word('moyo', variant)
    title = 'moyo'
    if suffix:
        thin, _ = LIGHT.text(suffix, dx=width + 0.34 * X, tracking=0.012 * LIGHT.upm)
        w_ink = w_ink + thin
        title = 'moyo ' + suffix
    x0, y0, x1, y1 = bounds(w_ink, w_acc) if w_acc else bounds(w_ink)
    p = pad * X
    return svg_doc(x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p, fill(w_ink, fg) + fill(w_acc, accent), title), x1 - x0 + 2 * p, y1 - y0 + 2 * p


def o_center(x_start, dy=0.0):
    b = bounds(HEAVY.glyph(HEAVY.name('o')))
    return x_start + (b[0] + b[2]) / 2.0, dy + (b[1] + b[3]) / 2.0, (b[2] - b[0]) / 2.0


def handle(cx, cy, r, width, length):
    """Mercek sapı: dairenin sağ altından 45° dışarı kısa, yuvarlak uçlu çubuk."""
    a = math.radians(45)
    return ribbon(turtle((cx + r * math.cos(a), cy + r * math.sin(a)), 45, [('L', length)]), width)


def icon(product, family, variant, size=1024):
    """Uygulama iconu: kare, köşesiz (köşeyi işletim sistemi keser), saydam alan yok."""
    P = PRODUCTS[product]
    extra = ''
    if family == '1':                       # yatay sözcük
        ink, acc, width, starts = word('moyo', variant)
        if product == 'mercek':
            cx, cy, r = o_center(starts[3])
            acc = acc + handle(cx, cy, r - 0.30 * S, 0.82 * S, 0.30 * S + 0.62 * X)
        frac = 0.76
    elif family == '2':                     # yalnız y
        ink, acc, _ = letter('y', variant)
        acc = list(acc)
        frac = 0.56
        if product == 'mercek':             # y, mercek halkasının içinde
            x0, y0, x1, y1 = bounds(ink, acc) if acc else bounds(ink)
            cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
            R = 0.5 * math.hypot(x1 - x0, y1 - y0) + 0.16 * X
            sw = 0.20 * X
            extra = '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="%s"/>' % (num(cx), num(cy), num(R), P['accent'], num(sw))
            acc = acc + handle(cx, cy, R + sw / 2.0 - 0.04 * X, 0.26 * X, 0.50 * X)
            frac = 0.74
    else:                                   # iki satır: "mo" üstte, "yo" altta, sağa hizalı
        top_ink, _, top_w, _ = word('mo', variant)
        bot_ink, bot_acc, bot_w, bs = word('yo', variant, dy=X + 0.22 * X)
        dx = top_w - bot_w
        ink = top_ink + move(bot_ink, dx)
        acc = move(bot_acc, dx)
        if product == 'mercek':
            cx, cy, r = o_center(bs[1] + dx, X + 0.22 * X)
            acc = acc + handle(cx, cy, r - 0.30 * S, 0.82 * S, 0.30 * S + 0.56 * X)
        frac = 0.66
    x0, y0, x1, y1 = bounds(ink, acc) if acc else bounds(ink)
    if extra:
        x0, y0 = min(x0, cx - R - sw / 2), min(y0, cy - R - sw / 2); x1, y1 = max(x1, cx + R + sw / 2), max(y1, cy + R + sw / 2)
    w, h = x1 - x0, y1 - y0
    s = size * frac / max(w, h)
    tx = size / 2.0 - s * (x0 + w / 2.0); ty = size / 2.0 - s * (y0 + h / 2.0)
    body = ('<rect width="%d" height="%d" fill="%s"/><g transform="translate(%s %s) scale(%.4f)">%s%s%s</g>'
            % (size, size, P['bg'], num(tx), num(ty), s, fill(ink, P['fg']), extra, fill(acc, P['accent'])))
    return svg_doc(0, 0, size, size, body, P['ad'] + ' iconu')


def contrast(c1, c2):
    def lum(c):
        v = [int(c[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
        v = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
        return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
    hi, lo = sorted([lum(c1), lum(c2)], reverse=True)
    return (hi + 0.05) / (lo + 0.05)
