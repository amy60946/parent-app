#!/usr/bin/env python3
"""Moyo tanıtım sayfası, yeni düzen (kullanıcı isteği 11 Kasım 2026): gerçek arayüzün yavaş, kendiliğinden oynayan gösterimi,
ferah yerleşim, sade ana menü, fiyat ayrı sayfada. Marka: brand/ (sözcük logo, renk, yazı).

Metin tek kaynaktan: site/landing.html. Başlık ve paragraflar o dosyadan OKUNUR, burada yeniden yazılmaz; çıktıda kelimesi
kelimesine bulunduğu denetlenir. Burada yazılan tek yeni metin fiyat sayfasındaki plan satırlarıdır (kaynak: src/data/plans.ts).

    python3 site/yeni/build.py <çıktı klasörü> [--logo a|b|c] [--onizleme]

Çıktı: index.html (ana sayfa), fiyat.html, img/, fonts/. --onizleme: Artifact için (index iskeletsiz, logo seçici, yer tutucu notu,
yazı tipi Google Fonts'tan; fonts/ kopyalanmaz).
Yayındaki siteyi (build-cf.sh, landing.html) etkilemez.
"""
import html
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
ROOT = os.path.dirname(SITE)
sys.path.insert(0, os.path.join(ROOT, 'brand'))
import kit  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = args[0] if args else os.path.join(HERE, 'out')
PREVIEW = '--onizleme' in sys.argv
LOGO = sys.argv[sys.argv.index('--logo') + 1] if '--logo' in sys.argv else (kit.SELECTED['logo'] or 'a')
MULTI = PREVIEW and not kit.SELECTED['logo']     # logo seçilmediyse önizlemede A / B / C seçicisi
APP = '' if PREVIEW else 'app/index.html'   # önizlemede giriş / kayıt bağlantıları sayfada kalır

src = open(os.path.join(SITE, 'landing.html'), encoding='utf-8').read()
one = lambda pat: re.search(pat, src, re.S).group(1)

# --- İçerik: landing.html'den (kelimesi kelimesine) -------------------------------------------------------------------
TAGLINE = one(r'<p class="eyebrow tagline">(.*?)</p>')
H1 = one(r'<h1 id="hero-title">(.*?)</h1>')
LEAD = one(r'<p class="lead">(.*?)</p>')
# Kullanıcı (13 Kasım 2026): "6–12 yaş" ile başlayan ilk cümle çıkar; kalan kısım alt başlığın altında, daha küçük.
LEAD2 = LEAD.split('. ', 1)[1] if LEAD.startswith('6') and '. ' in LEAD else LEAD
assert LEAD2 != LEAD and not LEAD2.startswith('6')
CTA1 = one(r'<a class="btn btn-primary" href="app/index.html#kayit">(.*?)</a>')
CTA2 = one(r'<a class="btn btn-ghost" href="#nasil">(.*?)</a>')
FINE = re.findall(r'<span>(.*?)</span>', one(r'<p class="fine">(.*?)</p>'))
GAIN_H = one(r'<h2 id="gain-title">(.*?)</h2>')
GAINS = re.findall(r'<article class="gain">.*?<h3>(.*?)</h3><p>(.*?)</p></article>', src, re.S)
HOW_H, HOW_P = re.search(r'<h2 id="how-title">(.*?)</h2><p>(.*?)</p>', src, re.S).groups()
STEPS = re.findall(r'<div class="txt"><span class="num">\d</span><h3>(.*?)</h3><p>(.*?)</p></div>', src, re.S)
CLOSING = one(r'<p class="closing">(.*?)</p>')
SAFE_H = one(r'<h2 id="safe-title">(.*?)</h2>')
SAFE = re.findall(r'<div>(<svg.*?</svg>)<h3>(.*?)</h3><p>(.*?)</p></div>', one(r'<div class="safe">(.*?)</div>\s*<p class="limit">'), re.S)
LIMIT = one(r'<p class="limit">(.*?)</p>')
PRICE_H = one(r'<h2 id="price-title">(.*?)</h2>')
TERMS = one(r'<p class="terms">(.*?)</p>')
FAQ_H = one(r'<h2 id="faq-title">(.*?)</h2>')
FAQ = re.findall(r'<details><summary>(.*?)</summary><p>(.*?)</p></details>', src, re.S)
FINAL_H = one(r'<div class="wrap final">\s*<h2>(.*?)</h2>')
CTA3 = one(r'<a class="btn btn-ghost" href="app/index.html#giris">(.*?)</a>')
STORES = re.findall(r'<span class="store"><img src="([^"]+)" alt=""><span><b>(.*?)</b>(.*?)</span></span>', src)
FOOT = re.findall(r'<a href="([^"]+)">(.*?)</a>', one(r'<nav aria-label="Yasal ve destek">(.*?)</nav>'))
COPY = one(r'<small>(©.*?)</small>')
NAV_IN = one(r'<a class="btn btn-text" href="app/index.html#giris">(.*?)</a>')
NAV_UP = one(r'<nav class="nav".*?<a class="btn btn-primary" href="app/index.html#kayit">(.*?)</a>')
assert len(GAINS) == 4 and len(STEPS) == 3 and len(SAFE) == 4 and len(FAQ) >= 5 and len(STORES) == 2, (len(GAINS), len(STEPS), len(SAFE), len(FAQ), len(STORES))

# Fiyat sayfası (kaynak: src/data/plans.ts premiumFeatures / freeFeatures, landing.html fiyat bölümü). Rakamlar YER TUTUCU.
P_MONTH, P_YEAR = '— TL', '— TL'
PREMIUM = ['Sınırsız macera ve çocuk', 'Ödüller ve Güneş Taşı', 'Çocuğunuzla mesajlaşma', 'Davranış kayıtları (sesli) ve arşiv', 'İki ebeveyn aynı üyelikle']
FREE = ['1 çocuk', '3 etkin macera', 'Oyunla bağlantı', 'Uzmanla paylaşım']
GAME = one(r'<h3>Pofi Adası</h3>.*?<ul>(.*?)</ul>')
GAME = re.findall(r'<li>(.*?)</li>', GAME)
TABLE = [('Çocuk', '1', 'Sınırsız'), ('Etkin macera', '3', 'Sınırsız'), ('Oyunla bağlantı', True, True), ('Uzmanla paylaşım', True, True),
         ('Ödüller ve Güneş Taşı', False, True), ('Çocuğunuzla mesajlaşma', False, True), ('Davranış kayıtları ve arşiv', False, True)]
PRICE_FAQ = [('Deneme bitince ne olur?', 'Aylık ya da yıllık üyeliği seçebilir ya da sınırlı ücretsiz sürümle devam edebilirsiniz. Kayıtlarınız silinmez.'),
             ('Üyelik kimleri kapsar?', 'Tek ücret bütün aileyi kapsar: iki ebeveyn ve bütün çocuklar.'),
             ('Nasıl iptal ederim?', 'Üyelik App Store üzerinden yönetilir; iPhone ya da iPad’inizde Ayarlar › Apple hesabınız › Abonelikler bölümünden istediğiniz zaman iptal edebilirsiniz.'),
             ('Web’den satın alabilir miyim?', 'Hayır. Üyelik iPhone ya da iPad’deki Moyo’dan başlatılır; aynı hesapla web’de de açılır.'),
             ('Oyun ücretli mi?', 'Hayır. Pofi Adası ücretsizdir; içinde reklam ve satın alma yoktur.')]


# Gerçek Moyo ekranları (ekranlar.py üretir; deneme verisi, adlar kurgusal)
SHOTS = json.load(open(os.path.join(HERE, 'img', 'ekranlar.json'), encoding='utf-8'))
FAYDA_EKRAN = ['gelisim', 'maceralar', 'odul', 'ekle']   # faydaların sırasıyla


# --- Parçalar ---------------------------------------------------------------------------------------------------------
def svg_inner(svg):
    m = re.match(r'<svg[^>]*viewBox="([^"]+)"[^>]*>(.*)</svg>\s*$', svg, re.S)
    return m.group(1), re.sub(r'<title>.*?</title>', '', m.group(2))


def logo(ink):
    out = []
    for v in (kit.VARIANTS if MULTI else [LOGO]):
        vb, body = svg_inner(kit.wordmark(v, ink, pad=0.04)[0])
        out.append('<svg viewBox="%s" role="img" aria-label="moyo" data-logo="%s"%s>%s</svg>' % (vb, v, '' if v == LOGO else ' hidden', body))
    return ''.join(out)


def app_icon():
    out = []
    for v in (kit.VARIANTS if MULTI else [LOGO]):
        vb, body = svg_inner(kit.icon('moyo', '3', v))
        out.append('<svg viewBox="%s" aria-hidden="true" data-logo="%s"%s>%s</svg>' % (vb, v, '' if v == LOGO else ' hidden', body))
    return ''.join(out)


BAR = '<div class="bar"><span>9:41</span><span>●●●</span></div>'
WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']


def tabs(on):
    return '<div class="tabs">' + ''.join('<span%s>%s</span>' % (' class="on"' if n == on else '', n) for n in ['Bugün', 'Uzmanım', 'Maceralar', 'Gelişim', 'Aile']) + '</div>'


def row(title, sub='', done=True):
    return '<div class="row"><span class="ck%s">%s</span><div class="grow"><b>%s</b>%s</div></div>' % (' on' if done else '', '✓' if done else '', title, '<span class="mut">%s</span>' % sub if sub else '')


def phone(inner, cls=''):
    return '<div class="phone" aria-hidden="true"><div class="scr%s">%s</div></div>' % (' ' + cls if cls else '', inner)


def real_phone(name, extra=''):
    """Gerçek uygulama ekranı telefon çerçevesinde (üstte durum çubuğu payı, ekranın üst rengiyle)."""
    sh = SHOTS[name]
    return ('<div class="phone gercek" aria-hidden="true"><div class="scr" style="background:%s">%s<img class="ekran" src="img/%s" alt="" loading="lazy"></div></div>'
            % (sh['ust_renk'], extra, sh['dosya']))


def push(title, text, icon_html):
    return '<div class="bildirim">%s<div><b>%s</b>%s</div></div>' % (icon_html, title, text)


POFI = '<img src="img/pofi-simge.png" alt="">'
# Faydalar: uygulamadaki ekranların sade kopyaları (adlar örnek; alternatifler/ekranlar.py ile aynı içerik)
F = [
    BAR + '<div class="pad"><div><div class="t">Maceralar</div><div class="mut">Nazlı · bugün 3 macera</div></div><div class="card">'
    + row('Yatağını topla', '07:30') + row('Dişlerini fırçala', '08:00') + row('Kitap oku, 15 dakika', '20:30', False)
    + '</div><div class="sec">Gelişim</div><div class="seg3"><span>Günlük</span><span class="on">Haftalık</span><span>Aylık</span></div><div class="card"><div class="cubuk">'
    + ''.join('<i style="--h:%d%%"></i>' % h for h in [55, 70, 65, 85, 80, 95, 90]) + '</div><div class="gun">' + ''.join('<span>%s</span>' % d for d in WEEK) + '</div></div></div>',
    BAR + '<div class="pad"><div class="mut" style="text-align:center">Nazlı’nın tableti</div><div class="saat">20:00</div>'
    + push('Pofi Adası · şimdi', 'Dişlerini fırçalama zamanı! Okti seni bekliyor.', POFI) + push('Pofi Adası · 19:30', 'Çantanı hazırlama zamanı.', POFI) + '</div>',
    BAR + '<div class="pad"><div><div class="t">Bugün</div><div class="mut">Nazlı</div></div><div class="card">'
    + row('Yatağını topla') + row('Dişlerini fırçala') + row('Çantanı hazırla') + row('Sofrayı kur') + row('Kitap oku, 15 dakika') + '</div></div>',
    BAR + '<div class="pad"><div><div class="t">Macera ekle</div><div class="mut">Nazlı için · <span class="pill">6–8 yaş</span></div></div>'
    '<div class="chips"><span class="chip on">Ev İşleri</span><span class="chip">Öğrenme</span><span class="chip">Sağlık ve Spor</span><span class="chip">Odak</span></div><div class="sec">Önerilenler</div><div class="card">'
    + ''.join('<div class="row"><div class="grow"><b>%s</b></div><span class="arti">+</span></div>' % t for t in ['Yatağını topla', 'Sofrayı kur', 'Oyuncaklarını yerine koy', 'Bitkileri sula']) + '</div></div>',
]
F_CLS = ['', 'gece', '', '']
N = [
    BAR + '<div class="pad"><div><div class="t">Alanları seç</div><div class="mut">Nazlı için birkaç alan</div></div>'
    '<div class="chips"><span class="chip on">Ev İşleri</span><span class="chip on">Sağlık ve Spor</span><span class="chip">Öğrenme</span><span class="chip on">Odak</span></div>'
    '<div class="card">' + row('Dişlerini fırçala', '20:00') + row('Kitap oku, 15 dakika', '20:30') + '</div></div>',
    BAR + '<div class="pad"><div class="mut" style="text-align:center">Nazlı’nın tableti</div><div class="saat">20:06</div>'
    + push('Pofi Adası · şimdi', 'Dişlerini fırçaladın! Okti’yi yıkama zamanı.', POFI) + '</div>',
    BAR + '<div class="pad"><div><div class="t">Onay bekleyen</div><div class="mut">1 macera</div></div><div class="card"><div class="row"><img class="av" src="img/okti_kiz_4.jpg" alt=""><div class="grow"><b>Dişlerini fırçala</b><span class="mut">Nazlı · 20:06</span></div><span class="ck on">✓</span></div></div>'
    '<div class="arti1 acik"><img src="img/gunes-tasi.png" alt="">+1 puan</div></div>',
]
N_CLS = ['', 'gece', '']


def gosterim():
    """Üst bölümün sağı: oyun ekranı ile Moyo'nun gerçek onay ekranı yan yana (kullanıcı, 13 Kasım 2026).
    Hareket: çocuk tablette "Yaptım"a dokunur → telefona bildirim → ebeveyn "Onayla"ya dokunur → oyunda "Onaylandı".
    Durağan hâli (JS yok / hareketi azalt): onay bekliyor."""
    b = SHOTS['onay']['onayla']
    dot_b = 'left:%.2f%%;top:%.2f%%' % (b['cx'], b['cy'])
    tablet = ('<div class="cihaz cihaz-tablet"><div class="tablet"><div class="tscr"><img src="img/iskele.jpg" alt="">'
              '<div class="gorev"><small>Bugünün macerası</small><b>Dişlerini fırçala</b><span class="dgm"><span class="q-a">Yaptım</span><span class="q-b">Onay bekliyor</span><span class="q-c">Onaylandı ✓</span></span></div>'
              '<span class="nokta nokta-a"><i>Nazlı</i></span></div></div></div>')
    over = (push('Moyo · şimdi', 'Nazlı macerayı tamamladı: Dişlerini fırçala', '<span class="ik">%s</span>' % app_icon())
            + '<span class="nokta nokta-b" style="%s"><i>Siz</i></span>' % dot_b)
    phone_ = '<div class="cihaz cihaz-telefon">%s</div>' % real_phone('onay', over).replace(' loading="lazy"', '')
    return ('<div class="ikili-kap"><div class="ikili yok-js s-done" data-gosterim role="img" aria-label="Gösterim: çocuğunuz oyunda macerayı tamamlar, Moyo size bildirir, siz onaylarsınız; oyunda onaylandığını görür.">'
            + tablet + phone_ + '</div><div class="ikili-alt"><button type="button" class="dur" id="gosterim-dur" aria-pressed="false">Durdur</button>'
            '<p class="altyazi">Arkada çocuğunuzun tableti (Pofi Adası, örnek gösterim), önde sizin telefonunuzda Moyo’nun gerçek onay ekranı. Adlar örnektir.</p></div></div>')


def ust(page):
    here = '' if page == 'ana' else 'index.html'
    items = [(here + '#faydalar', 'Faydalar', ''), (here + '#nasil', 'Nasıl çalışır', ''), (here + '#guvenlik', 'Güvenlik', ''),
             ('fiyat.html', 'Fiyat', ' aria-current="page"' if page == 'fiyat' else ''), (here + '#sss', 'Sorular', '')]
    links = ''.join('<a href="%s"%s>%s</a>' % (h, attr, label) for h, label, attr in items)
    return ('<header class="ust"><div class="inner"><a class="logo" href="index.html" aria-label="Moyo ana sayfa">%s</a><nav class="menu" aria-label="Ana menü">%s</nav>'
            '<div class="sag"><a class="hap cizgi k" href="%s#giris">%s</a><a class="hap dolu k" href="%s#kayit">%s</a>'
            '<details class="acilir"><summary aria-label="Menü"><span></span></summary><nav aria-label="Menü">%s<a href="%s#giris">%s</a></nav></details></div></div></header>'
            % (logo('yesil'), links, APP, NAV_IN, APP, NAV_UP, links, APP, NAV_IN))


def alt():
    return ('<footer class="alt"><div class="inner"><a class="logo" href="index.html" aria-label="Moyo ana sayfa">%s</a><nav aria-label="Yasal ve destek">%s</nav><small>%s</small></div></footer>'
            % (logo('yesil'), ''.join('<a href="%s">%s</a>' % f for f in FOOT), COPY))


def extras():
    if not MULTI:
        return ''
    return ('<div class="logo-sec" role="group" aria-label="Önizleme: logo alternatifi">Logo'
            + ''.join('<button type="button" id="logo-%s" data-v="%s" aria-pressed="%s">%s</button>' % (v, v, 'true' if v == LOGO else 'false', v.upper()) for v in kit.VARIANTS) + '</div>')


def ana():
    satirlar = ''.join('<article class="satir"><div><h3>%s</h3><p>%s</p></div><div class="gorsel">%s</div></article>'
                       % (t, p, real_phone(FAYDA_EKRAN[i])) for i, (t, p) in enumerate(GAINS))
    adimlar = ''.join('<article class="adim"><div class="ust-gorsel">%s</div><div class="ic"><span class="no">%d</span><h3>%s</h3><p>%s</p></div></article>'
                      % (phone(N[i], N_CLS[i]), i + 1, t, p) for i, (t, p) in enumerate(STEPS))
    guven = ''.join('<div>%s<h3>%s</h3><p>%s</p></div>' % s for s in SAFE)
    sss = ''.join('<details><summary>%s</summary><p>%s</p></details>' % q for q in FAQ)
    magaza = ''.join('<span class="m"><span class="ik">%s</span><span><b>%s</b>%s</span></span>' % (app_icon() if 'parentapp' in img else '<img src="%s" alt="">' % img, name, note) for img, name, note in STORES)
    return f'''{extras()}{ust('ana')}
<main>
  <section class="band koyu kahraman" aria-labelledby="ust-baslik">
    <div class="inner kahraman-ic">
      <div class="yazi">
        <h1 id="ust-baslik">{TAGLINE}</h1>
        <p class="alt-baslik">{H1}</p>
        <p class="giris">{LEAD2}</p>
        <div class="dugmeler"><a class="hap dolu b" href="{APP}#kayit">{CTA1}</a><a class="hap cizgi b" href="#nasil">{CTA2}</a></div>
        <p class="ince">{''.join('<span>%s</span>' % f for f in FINE)}</p>
      </div>
      {gosterim()}
    </div>
  </section>

  <section class="band acik" id="faydalar" aria-labelledby="fayda-baslik">
    <div class="inner">
      <div class="bas"><h2 id="fayda-baslik">{GAIN_H}</h2></div>
      <div class="satirlar">{satirlar}</div>
    </div>
  </section>

  <section class="band sis" id="nasil" aria-labelledby="nasil-baslik">
    <div class="inner">
      <div class="bas"><h2 id="nasil-baslik">{HOW_H}</h2><p>{HOW_P}</p></div>
      <div class="adimlar">{adimlar}</div>
      <p class="kapanis">{CLOSING}</p>
    </div>
  </section>

  <section class="band koyu" id="guvenlik" aria-labelledby="guven-baslik">
    <div class="inner">
      <div class="bas"><h2 id="guven-baslik">{SAFE_H}</h2></div>
      <div class="guven">{guven}</div>
      <p class="sinir">{LIMIT}</p>
    </div>
  </section>

  <section class="band acik" id="sss" aria-labelledby="sss-baslik">
    <div class="inner">
      <div class="bas"><h2 id="sss-baslik">{FAQ_H}</h2></div>
      <div class="sss">{sss}</div>
    </div>
  </section>

  <section class="band sis" aria-labelledby="cagri-baslik">
    <div class="inner cagri">
      <h2 id="cagri-baslik">{FINAL_H}</h2>
      <div class="dugmeler"><a class="hap dolu b" href="{APP}#kayit">{CTA1}</a><a class="hap cizgi b" href="{APP}#giris">{CTA3}</a></div>
      <div class="magaza" aria-label="Mağaza durumu">{magaza}</div>
    </div>
  </section>
</main>
{alt()}'''


def fiyat():
    def mark(v):
        return ('<span class="var" aria-label="Var">✓</span>' if v is True else '<span class="yok" aria-label="Yok">—</span>') if isinstance(v, bool) else v
    tablo = ''.join('<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % (a, mark(b), mark(c)) for a, b, c in TABLE)
    sss = ''.join('<details><summary>%s</summary><p>%s</p></details>' % q for q in PRICE_FAQ)
    li = lambda xs: ''.join('<li>%s</li>' % x for x in xs)
    note = '<p class="onizleme-notu">Önizleme: fiyat rakamları yer tutucudur (— TL). Rakamlar karardan sonra yazılacak.</p>' if PREVIEW else ''
    return f'''{extras()}{ust('fiyat')}{note}
<main>
  <section class="band koyu fiyat-ust" aria-labelledby="fiyat-baslik">
    <div class="inner"><div class="yazi">
      <h1 id="fiyat-baslik">{PRICE_H}</h1>
      <p class="giris">{FINE[0]}. {FINE[1]}.</p>
      <div class="seg" data-donem role="group" aria-label="Ödeme dönemi"><button type="button" id="donem-aylik" data-d="aylik" aria-pressed="false">Aylık</button><button type="button" id="donem-yillik" data-d="yillik" aria-pressed="true">Yıllık <span class="rozet">avantajlı</span></button></div>
    </div></div>
  </section>
  <section class="planlar-bant">
    <div class="inner">
      <div class="planlar">
        <article class="plan"><div class="govde"><h2>Ücretsiz</h2><p class="tutar">0 TL</p><p class="not">Deneme bittikten sonra sınırlı sürümle devam edebilirsiniz.</p>
          <a class="hap cizgi" href="{APP}#kayit">{CTA1}</a><span class="baslik-k">İçinde</span><ul>{li(FREE)}</ul></div></article>
        <article class="plan one"><div class="serit">{FINE[0]}</div><div class="govde"><h2>Premium</h2>
          <p class="tutar" data-donem-goster="aylik" hidden>{P_MONTH} <small>/ ay</small></p><p class="tutar" data-donem-goster="yillik">{P_YEAR} <small>/ yıl</small></p>
          <p class="not" data-donem-goster="aylik" hidden>7 gün ücretsiz, sonra aylık {P_MONTH}. Her ay kendiliğinden yenilenir; App Store’dan istediğiniz zaman iptal edebilirsiniz.</p>
          <p class="not" data-donem-goster="yillik">7 gün ücretsiz, sonra yıllık {P_YEAR}. Her yıl kendiliğinden yenilenir; App Store’dan istediğiniz zaman iptal edebilirsiniz.</p>
          <a class="hap dolu" href="{APP}#kayit">{CTA1}</a><span class="baslik-k">Ücretsiz sürüme ek olarak</span><ul>{li(PREMIUM)}</ul></div></article>
        <article class="plan"><div class="govde"><h2>{STORES[1][1]}</h2><p class="tutar">Ücretsiz</p><p class="not">Çocuğunuzun oynadığı oyun. Moyo ile birlikte çalışır.</p>
          <span class="baslik-k">İçinde</span><ul>{li(GAME)}</ul></div></article>
      </div>
      <p class="kosul">{TERMS}</p>
    </div>
  </section>
  <section class="band acik" aria-labelledby="kars-baslik">
    <div class="inner">
      <div class="bas"><h2 id="kars-baslik">Planları karşılaştırın</h2></div>
      <div class="tablo-kap"><table class="kars"><thead><tr><th scope="col">Özellik</th><th scope="col">Ücretsiz</th><th scope="col">Premium</th></tr></thead><tbody>{tablo}</tbody></table></div>
    </div>
  </section>
  <section class="band sis" aria-labelledby="fsss-baslik">
    <div class="inner">
      <div class="bas"><h2 id="fsss-baslik">{FAQ_H}</h2></div>
      <div class="sss">{sss}</div>
    </div>
  </section>
  <section class="band acik" aria-labelledby="fcagri-baslik">
    <div class="inner cagri">
      <h2 id="fcagri-baslik">{FINAL_H}</h2>
      <div class="dugmeler"><a class="hap dolu b" href="{APP}#kayit">{CTA1}</a><a class="hap cizgi b" href="index.html#nasil">{CTA2}</a></div>
    </div>
  </section>
</main>
{alt()}'''


def page(title, body, full):
    css = open(os.path.join(HERE, 'sayfa.css'), encoding='utf-8').read()
    js = open(os.path.join(HERE, 'demo.js'), encoding='utf-8').read()
    link = ''
    if PREVIEW:        # Artifact'te yazı tipi yalnız Google Fonts'tan yüklenir; sitede brand/fonts/ dosyalarından (Google'a istek gitmez)
        css = re.sub(r'@font-face\{[^}]*\}\n', '', css)
        link = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap">\n'
    head = '<title>%s</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n%s<style>\n%s</style>\n' % (title, link, css) if not full else ''
    doc = head + body + '\n<script>\n' + js + '</script>\n'
    if full:
        doc = ('<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
               '<title>%s</title>\n%s<style>\nhtml{padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}\n%s</style>\n</head>\n<body>\n%s</body>\n</html>\n'
               % (title, link, css, body + '\n<script>\n' + js + '</script>\n'))
    return doc


def check(doc, texts):
    plain = html.unescape(re.sub(r'<[^>]+>', '', doc))
    for t in texts:
        want = html.unescape(re.sub(r'<[^>]+>', '', t))
        assert want in plain, 'Metin değişmiş ya da eksik: ' + want[:70]


def main():
    os.makedirs(OUT, exist_ok=True)
    a, f = ana(), fiyat()
    check(a, [TAGLINE, H1, LEAD2, GAIN_H, HOW_H, HOW_P, CLOSING, SAFE_H, LIMIT, FAQ_H, FINAL_H] + [x for g in GAINS for x in g] + [x for s in STEPS for x in s]
          + [x for s in SAFE for x in s[1:]] + [x for q in FAQ for x in q])
    check(f, [PRICE_H, TERMS] + GAME)
    assert 'TL' not in re.sub(r'<[^>]+>', '', a), 'Ana sayfada fiyat olmamalı'
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(page('Moyo Tanıtım Sayfası' if PREVIEW else 'Moyo', a, full=not PREVIEW))
    open(os.path.join(OUT, 'fiyat.html'), 'w', encoding='utf-8').write(page('Moyo · Fiyatlandırma', f, full=True))
    used = set(re.findall(r'img/([A-Za-z0-9_.-]+)', a + f))
    copies = [('img', os.path.join(SITE, 'public', 'img'), lambda n: n in used), ('img', os.path.join(HERE, 'img'), lambda n: n in used)]
    if not PREVIEW:
        copies.append(('fonts', os.path.join(ROOT, 'brand', 'fonts'), lambda n: n.startswith('outfit-') and re.search(r'-(400|600|800)-', n)))
    for d, srcdir, keep in copies:
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
        for n in os.listdir(srcdir):
            if keep(n):
                shutil.copy(os.path.join(srcdir, n), os.path.join(OUT, d, n))
    print('ana %d bayt · fiyat %d bayt → %s' % (len(a), len(f), OUT))


if __name__ == '__main__':
    main()
