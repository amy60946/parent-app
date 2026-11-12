#!/usr/bin/env python3
"""Marka kitini üretir: brand/svg/ (logo, kilit, icon), brand/tokens.css + tokens.json ve önizleme sayfası.

  python3 brand/build.py                 # SVG'ler ve değişkenler
  python3 brand/build.py <çıktı klasörü>  # ayrıca önizleme (index.html; Artifact için); çıktı depoya girmez
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
NOTES = {
    'a': ('Kıvrım', 'Kuyruk aşağı iner, sola döner ve içe kıvrılır. İstediğin harekete en yakın olan.', True),
    'b': ('Gülüş', 'Kuyruk sola doğru uzanıp hafifçe yükselir; sözcüğün altında bir gülüş. Referanstan en uzak olan.', False),
    'c': ('Top', 'Kısa bir kanca ve ucunda ayrı duran top. Oyunla bağ kurar; küçük boyda da seçilir.', False),
}
FAMILY_NOTES = {'1': 'Sözcüğün tamamı. Adı doğrudan okutur; küçük boyda harfler incelir.',
                '2': 'Yalnız “y”. En sade ve en iri; ad okunmaz, şekil tanınır.',
                '3': '“mo” üstte, “yo” altta. Kareyi doldurur, küçük boyda da okunur.'}


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8') as f:
        f.write(text)


def inner(svg):
    """<svg …>içerik</svg> → (viewBox, içerik)"""
    m = re.match(r'<svg[^>]*viewBox="([^"]+)"[^>]*>(.*)</svg>\s*$', svg, re.S)
    return m.group(1), re.sub(r'<title>.*?</title>', '', m.group(2))


def build_files():
    n = 0
    for v in kit.VARIANTS:
        for ink in kit.INKS:
            for suffix in (None, 'mercek', 'oyun'):
                svg, _, _ = kit.wordmark(v, ink, suffix)
                write(os.path.join(HERE, 'svg', 'logo', 'moyo%s-%s-%s.svg' % ('-' + suffix if suffix else '', v, ink)), svg); n += 1
        for fam in kit.FAMILIES:
            for p in kit.PRODUCTS:
                write(os.path.join(HERE, 'svg', 'icon', '%s-%s%s.svg' % (p, fam, v)), kit.icon(p, fam, v)); n += 1
    css = ['/* Moyo marka değişkenleri (brand/build.py üretir; elle düzenlenmez). */', ':root{']
    css += ['  --moyo-%s:%s; /* %s */' % (var, val, use) for _, var, val, use in kit.PALETTE]
    css += ['  --moyo-yazi:"Outfit","Avenir Next","Segoe UI",system-ui,sans-serif;', '  --moyo-baslik-kalinlik:800;', '  --moyo-govde-kalinlik:400;',
            '  --moyo-kose:999px; /* düğmeler hap biçiminde */', '  --moyo-kart-kose:20px;', '  --moyo-bolum-boslugu:120px;', '  --moyo-icerik-genisligi:1120px;', '}']
    write(os.path.join(HERE, 'tokens.css'), '\n'.join(css) + '\n')
    write(os.path.join(HERE, 'tokens.json'), json.dumps({
        'renkler': {var: {'ad': ad, 'deger': val, 'kullanim': use} for ad, var, val, use in kit.PALETTE},
        'yazi': {'aile': 'Outfit', 'lisans': 'SIL OFL 1.1', 'baslik': 800, 'ara': 600, 'govde': 400, 'ince': 300,
                 'olcek_px': {'h1': 58, 'h2': 50, 'h3': 32, 'giris': 24, 'govde': 18, 'kucuk': 14}},
        'logo': {'harfler': 'Poppins ExtraBold (SIL OFL 1.1) dış çizgisi; "y" özgün', 'alternatifler': kit.VARIANTS, 'secilen': None},
        'icon': {'aileler': kit.FAMILIES, 'urunler': {k: {x: p[x] for x in ('ad', 'bg', 'fg', 'accent')} for k, p in kit.PRODUCTS.items()}, 'secilen': None},
    }, ensure_ascii=False, indent=2) + '\n')
    return n


def build_preview(out):
    defs, logos, locks, icons = [], [], [], []
    def sym(sid, svg):
        vb, body = inner(svg)
        defs.append('<symbol id="%s" viewBox="%s">%s</symbol>' % (sid, vb, body))
        return vb
    def use(sid, vb, label):          # dış viewBox 0 0 g y: <use> sembolü (0, 0)'a yerleştirir, sembolün kendi viewBox'ı ölçekler
        w, h = vb.split()[2:]
        return '<svg viewBox="0 0 %s %s" role="img" aria-label="%s"><use href="#%s" width="%s" height="%s"/></svg>' % (w, h, label, sid, w, h)
    for v, (name, note, rec) in NOTES.items():
        vb_l = sym('wm-%s-l' % v, kit.wordmark(v, 'lacivert')[0]); vb_d = sym('wm-%s-d' % v, kit.wordmark(v, 'yesil')[0])
        logos.append('<div class="opt"><div class="swatch on-light">%s</div><div class="swatch on-dark">%s</div><h3>%s %s%s</h3><p class="muted small">%s</p></div>'
                     % (use('wm-%s-l' % v, vb_l, 'moyo, ' + name), use('wm-%s-d' % v, vb_d, 'moyo, ' + name), v.upper(), name, '<span class="tag">önerilen</span>' if rec else '', note))
        cells = []
        for suffix in ('mercek', 'oyun'):
            for ink, cls in (('lacivert', 'on-light'), ('yesil', 'on-dark')):
                sid = 'lk-%s-%s-%s' % (v, suffix, ink)
                vb = sym(sid, kit.wordmark(v, ink, suffix)[0])
                cells.append('<div class="swatch %s">%s</div>' % (cls, use(sid, vb, 'moyo ' + suffix)))
        locks.append('<div class="locks" data-variant="%s"%s>%s</div>' % (v, '' if v == 'a' else ' hidden', ''.join(cells)))
        rows = []
        for fam, fname in kit.FAMILIES.items():
            ids = {}
            for p in kit.PRODUCTS:
                ids[p] = 'ic-%s-%s%s' % (p, fam, v)
                sym(ids[p], kit.icon(p, fam, v))
            def app(p, size):
                return '<span class="ic %s"><svg viewBox="0 0 1024 1024" role="img" aria-label="%s iconu"><use href="#%s"/></svg></span>' % (size, kit.PRODUCTS[p]['ad'], ids[p])
            big = ''.join('<div class="app">%s<span>%s</span></div>' % (app(p, 's112'), kit.PRODUCTS[p]['ad']) for p in kit.PRODUCTS)
            def wall(cls):
                return ('<div class="wall %s"><div class="row">%s</div><div class="tiny">%s</div></div>'
                        % (cls, ''.join('<div class="app">%s<span>%s</span></div>' % (app(p, 's60'), kit.PRODUCTS[p]['ad']) for p in kit.PRODUCTS),
                           ''.join(app(p, 's40') for p in kit.PRODUCTS) + ''.join(app(p, 's29') for p in kit.PRODUCTS)))
            rows.append('<div class="fam"><div class="opt"><h3>%s. %s%s</h3><p class="muted small">%s</p><div class="big">%s</div></div><div class="phones">%s%s</div></div>'
                        % (fam, fname, '<span class="tag">önerilen</span>' if fam == '3' else '', FAMILY_NOTES[fam], big, wall('l'), wall('d')))
        icons.append('<div data-variant="%s"%s>%s</div>' % (v, '' if v == 'a' else ' hidden', ''.join(rows)))
    colors = ''.join('<div class="color"><i style="background:%s"></i><b>%s</b><code>%s</code><span class="muted small">%s</span></div>' % (val, ad, val, use_) for ad, _, val, use_ in kit.PALETTE)
    C = kit.C
    pairs = [('Lacivert yazı, beyaz zemin', C['lacivert'], C['beyaz'], 'Açık bölümlerde başlık ve gövde'),
             ('Beyaz yazı, lacivert zemin', C['beyaz'], C['lacivert'], 'Koyu bölümlerde başlık ve gövde'),
             ('Lacivert yazı, yeşil zemin', C['lacivert'], C['yesil'], 'Ana düğme'),
             ('Marka yeşili, lacivert zemin', C['yesil-marka'], C['lacivert'], 'Koyu zeminde logo ve bağlantı'),
             ('Yazı 2, beyaz zemin', C['yazi-2'], C['beyaz'], 'İkincil yazı'),
             ('Yazı 3, beyaz zemin', C['yazi-3'], C['beyaz'], 'Açıklama; küçük gövde yazısında kullanma'),
             ('Yeşil yazı, beyaz zemin', C['yesil'], C['beyaz'], 'Kullanılmaz: okunmaz')]
    def row(label, fg, bg, use_):
        r = kit.contrast(fg, bg)
        verdict = 'yeterli' if r >= 4.5 else ('yalnız büyük yazı' if r >= 3 else 'yetersiz')
        return '<tr><td>%s</td><td><span class="pair" style="background:%s;color:%s;box-shadow:0 0 0 1px rgba(128,128,128,.35)">Moyo Aa</span></td><td class="num">%.1f : 1 · %s</td><td>%s</td></tr>' % (label, bg, fg, r, verdict, use_)
    html = open(os.path.join(HERE, 'onizleme.html'), encoding='utf8').read()
    for key, val in (('<!--DEFS-->', ''.join(defs)), ('<!--LOGOS-->', ''.join(logos)), ('<!--LOCKS-->', ''.join(locks)), ('<!--ICONS-->', ''.join(icons)),
                     ('<!--COLORS-->', colors), ('<!--PAIRS-->', ''.join(row(*p) for p in pairs))):
        assert key in html, key
        html = html.replace(key, val)
    write(os.path.join(out, 'index.html'), html)
    return len(html)


if __name__ == '__main__':
    print('svg dosyası:', build_files())
    if len(sys.argv) > 1:
        print('önizleme:', build_preview(sys.argv[1]), 'bayt')
