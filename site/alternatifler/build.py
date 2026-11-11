#!/usr/bin/env python3
"""Tanıtım sayfasının etkileşim alternatiflerini üretir (kullanıcı isteği 10 Kasım 2026: "içerikler aynı kalsın, UI/UX
deneyimi değişsin; animasyonlu / etkileşimli / kaydırdıkça güncellenen").

Kaynak tek: site/landing.html. Metin (faydalar, adımlar, kapanış) o dosyadan OKUNUR, burada yeniden yazılmaz; yalnız
"Faydalar" ve "Nasıl çalışır" bölümlerinin düzeni değişir, sayfanın geri kalanı (üst bölüm, güvenlik, fiyat, sorular) aynen
kalır. Çıktı (out/): kaydir.html, tek-ekran.html, dokun.html, simdiki.html (karşılaştırma için bugünkü sayfa), index.html
(önizleme kabuğu: seçici + telefon / bilgisayar genişliği + benchmark), img/, fonts/.

    python3 site/alternatifler/build.py [çıktı klasörü]

Yayındaki siteyi (build-cf.sh, landing.html) etkilemez. Seçilen alternatif landing.html'e ayrıca taşınır.
"""
import html
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out')
sys.path.insert(0, HERE)
import ekranlar as E  # noqa: E402


def read(name):
    return open(os.path.join(HERE, name), encoding='utf-8').read()


src = open(os.path.join(SITE, 'landing.html'), encoding='utf-8').read()

# --- İçerik: landing.html'den ----------------------------------------------------------------------------------------
one = lambda pat: re.search(pat, src, re.S).group(1)
GAIN_H = one(r'<h2 id="gain-title">(.*?)</h2>')
GAINS = re.findall(r'<article class="gain">.*?<h3>(.*?)</h3><p>(.*?)</p></article>', src, re.S)
HOW_H, HOW_P = re.search(r'<h2 id="how-title">(.*?)</h2><p>(.*?)</p>', src, re.S).groups()
STEPS = re.findall(r'<div class="txt"><span class="num">\d</span><h3>(.*?)</h3><p>(.*?)</p></div>', src, re.S)
CLOSING = one(r'<p class="closing">(.*?)</p>')
assert len(GAINS) == 4 and len(STEPS) == 3, (len(GAINS), len(STEPS))

A = src.index('  <!-- Faydalar')
B = src.index('  <!-- Güvenlik -->')
STYLE_END = src.index('</style>')
HEADER = src.index('<header')


def dots(n):
    return '<div class="dots" aria-hidden="true">' + ''.join('<span%s></span>' % (' class="on"' if i == 0 else '') for i in range(n)) + '</div>'


# --- 1 · Kaydır -------------------------------------------------------------------------------------------------------
def kaydir():
    def story(items, screens, kind, numbered):
        beats = ''.join(
            '<article class="beat%s">%s<h3>%s</h3><p>%s</p><div class="beat-screen">%s</div></article>'
            % (' on' if i == 0 else '', '<span class="num">%d</span>' % (i + 1) if numbered else '', t, p, E.tek_telefon(screens[i], i, kind))
            for i, (t, p) in enumerate(items))
        return ('<div class="story" data-story><div class="story-text">%s</div><div class="story-stage">%s%s</div></div>'
                % (beats, E.telefon(screens, kind), dots(len(items))))
    return f'''  <!-- Faydalar (alternatif 1 · Kaydır) -->
  <section class="section" id="faydalar" aria-labelledby="gain-title">
    <div class="wrap">
      <div class="head"><h2 id="gain-title">{GAIN_H}</h2></div>
      {story(GAINS, E.FAYDA, 'fayda', False)}
    </div>
  </section>

  <!-- Nasıl çalışır (alternatif 1 · Kaydır) -->
  <section class="section" id="nasil" aria-labelledby="how-title" style="padding-top:0">
    <div class="wrap">
      <div class="head"><h2 id="how-title">{HOW_H}</h2><p>{HOW_P}</p></div>
      {story(STEPS, E.ADIM, 'adim', True)}
      <p class="closing">{CLOSING}</p>
    </div>
  </section>

'''


# --- 2 · Tek ekran ----------------------------------------------------------------------------------------------------
def tek_ekran():
    def pin(sec_id, h_id, h, sub, items, screens, kind, numbered, skip, alt):
        texts = ''.join(
            '<article class="pin-text%s">%s<h3>%s</h3><p>%s</p></article>'
            % (' on' if i == 0 else '', '<span class="num">%d</span>' % (i + 1) if numbered else '', t, p) for i, (t, p) in enumerate(items))
        n = len(items)
        nav = ''.join('<button type="button" class="pin-dot%s" aria-label="%d / %d"><span></span></button>' % (' on' if i == 0 else '', i + 1, n) for i in range(n))
        return f'''  <section class="pin{' alt' if alt else ''}" id="{sec_id}" data-pin aria-labelledby="{h_id}">
    <div class="pin-inner"><div class="wrap pin-grid">
      <div class="pin-copy">
        <h2 class="pin-h" id="{h_id}">{h}</h2>
        {'<p class="pin-sub">%s</p>' % sub if sub else ''}
        <div class="pin-texts">{texts}</div>
        <div class="pin-nav"><div class="pin-dots">{nav}</div><span class="pin-count">1 / {n}</span><a class="pin-skip" href="#{skip}">Bölümü geç ↓</a></div>
      </div>
      <div class="pin-stage">{E.telefon(screens, kind)}</div>
    </div></div>
  </section>
'''
    return ('  <!-- Faydalar (alternatif 2 · Tek ekran) -->\n' + pin('faydalar', 'gain-title', GAIN_H, '', GAINS, E.FAYDA, 'fayda', False, 'nasil', False)
            + '\n  <!-- Nasıl çalışır (alternatif 2 · Tek ekran) -->\n' + pin('nasil', 'how-title', HOW_H, HOW_P, STEPS, E.ADIM, 'adim', True, 'kapanis', True)
            + f'  <div class="wrap pin-after" id="kapanis"><p class="closing">{CLOSING}</p></div>\n\n')


# --- 3 · Dokun --------------------------------------------------------------------------------------------------------
TRY = ['Deneyin: telefonda “3 macerayı ekle”ye dokunun.', 'Deneyin: oyunda “Yaptım”a dokunun.', 'Deneyin: ebeveyn olarak ✓ ile onaylayın.']
NOTE = ('<div class="note demo-note" role="status"><img src="img/parentapp-simge.png" alt=""><div><b>Moyo · şimdi</b>'
        'Nazlı macerayı tamamladı: Dişlerini fırçala</div></div>')


def dokun():
    def item(prefix, i, t, p, numbered, extra=''):
        return (f'<div class="tab3{" on" if i == 0 else ""}"><h3><button type="button" class="tab3-head" id="{prefix}-h{i}" aria-expanded="{"true" if i == 0 else "false"}" aria-controls="{prefix}-b{i}">'
                f'{"<span class=num>%d</span>" % (i + 1) if numbered else ""}<span class="tab3-title">{t}</span><span class="tab3-ico" aria-hidden="true"></span></button></h3>'
                f'<div class="tab3-body" id="{prefix}-b{i}" role="region" aria-labelledby="{prefix}-h{i}"><div class="tab3-in"><p>{p}</p>{extra}<div class="slot"></div></div></div>'
                f'{"" if numbered else "<i class=tab3-bar aria-hidden=true><b></b></i>"}</div>')
    gains = ''.join(item('f', i, t, p, False) for i, (t, p) in enumerate(GAINS))
    steps = ''.join(item('n', i, t, p, True, '<p class="try" aria-live="polite">%s</p>' % TRY[i]) for i, (t, p) in enumerate(STEPS))
    return f'''  <!-- Faydalar (alternatif 3 · Dokun: kendiliğinden ilerleyen, dokununca duran sekmeler) -->
  <section class="section" id="faydalar" aria-labelledby="gain-title">
    <div class="wrap">
      <div class="head"><h2 id="gain-title">{GAIN_H}</h2></div>
      <div class="tabs3" data-tabs="auto"><div class="tabs3-list">{gains}</div><div class="tabs3-stage">{E.telefon(E.FAYDA, 'fayda')}</div></div>
    </div>
  </section>

  <!-- Nasıl çalışır (alternatif 3 · Dokun: ziyaretçi üç dokunuşla dener) -->
  <section class="section" id="nasil" aria-labelledby="how-title" style="padding-top:0">
    <div class="wrap">
      <div class="head"><h2 id="how-title">{HOW_H}</h2><p>{HOW_P}</p></div>
      <div class="tabs3" data-tabs="demo"><div class="tabs3-list">{steps}<div class="demo-ctl"><button type="button" class="btn btn-ghost" data-reset hidden>Baştan dene</button></div></div><div class="tabs3-stage">{E.telefon(E.ADIM_CANLI, 'adim', gizli=False, ek=NOTE)}</div></div>
      <p class="closing">{CLOSING}</p>
    </div>
  </section>

'''


# --- Sayfa sarmalayıcı ------------------------------------------------------------------------------------------------
def page(middle, css, js, mark):
    s = src if middle is None else src[:A] + middle + src[B:]
    if css:
        s = s[:STYLE_END] + '\n' + css + s[STYLE_END:]
    # Önizlemede dış bağlantılar açılmaz (kayıt, giriş, yasal, destek): sayfa içinde kalır
    s = re.sub(r'href="(app/index\.html#[a-z]+|yasal/[a-z-]+|destek)"', 'href="#"', s)
    i = s.index('<header')
    return ('<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
            + s[:i] + '</head>\n<body data-alt="%s">\n' % mark + s[i:] + ('\n<script>\n' + js + '</script>' if js else '') + '\n</body>\n</html>\n')


os.makedirs(OUT, exist_ok=True)
ortak = read('ortak.css')
PAGES = {
    'simdiki.html': page(None, '', '', 'simdiki'),
    'kaydir.html': page(kaydir(), ortak + read('kaydir.css'), read('kaydir.js'), 'kaydir'),
    'tek-ekran.html': page(tek_ekran(), ortak + read('tek-ekran.css'), read('tek-ekran.js'), 'tek-ekran'),
    'dokun.html': page(dokun(), ortak + read('dokun.css'), read('dokun.js'), 'dokun'),
}
for name, body in PAGES.items():
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(body)

# Metin denetimi: her alternatifte bütün başlık ve paragraflar kelimesi kelimesine var
for name, body in PAGES.items():
    for t, p in GAINS + STEPS:
        assert t in body and p in body, (name, t[:30])
    assert CLOSING in body and GAIN_H in body and HOW_H in body and HOW_P in body, name

for d in ('img', 'fonts'):
    shutil.copytree(os.path.join(SITE, 'public', d), os.path.join(OUT, d), dirs_exist_ok=True)

# --- Önizleme kabuğu --------------------------------------------------------------------------------------------------
bench = json.load(open(os.path.join(HERE, 'benchmark.json'), encoding='utf-8'))
esc = html.escape
rows = ''.join(
    '<tr><th scope="row">{c}</th><td>{k}</td><td>{h}</td><td>{e}</td><td><a href="{u}" target="_blank" rel="noopener">{s}</a>{m}</td></tr>'.format(
        c=esc(b['sirket']), k=esc(b['kalip']), h=esc(b['nasil']), e=esc(b['basari']), u=esc(b['url']), s=esc(b['url'].split('//')[1].rstrip('/')),
        m='' if b.get('bakildi') else ' <span class="tagm">sayfa açılamadı, bilinen düzen</span>')
    for b in bench['ornekler'])
shell = read('kabuk.html').replace('@@BENCH_ROWS@@', rows).replace('@@BENCH_NOTE@@', esc(bench.get('not', '')))
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(shell)
print('yazıldı:', ', '.join(sorted(os.listdir(OUT))))
