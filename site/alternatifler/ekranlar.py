# Telefon içi örnek ekranlar (Moyo'nun sade kopyası; landing.html'deki .phone/.screen düzeniyle, ölçüler em: telefon
# genişliğiyle ölçeklenir). Adlar örnektir. Etkileşimli alternatifte (dokun) düğmeler gerçek <button> olur.
BAR = '<div class="bar"><span>9:41</span><span>●●●</span></div>'


def tabs(on):
    names = ['Bugün', 'Uzmanım', 'Maceralar', 'Gelişim', 'Aile']
    return '<div class="tabs">' + ''.join('<span class="on">%s</span>' % n if n == on else '<span>%s</span>' % n for n in names) + '</div>'


def row(title, sub='', done=True):
    ck = '<span class="ck on">✓</span>' if done else '<span class="ck"></span>'
    return '<div class="row">%s<div class="grow"><b>%s</b>%s</div></div>' % (ck, title, '<div class="muted">%s</div>' % sub if sub else '')


def bars(hs, labels):
    return ('<div class="bars" style="--n:%d">%s</div><div class="days" style="--n:%d">%s</div>'
            % (len(hs), ''.join('<i style="--h:%d%%"></i>' % h for h in hs), len(hs), ''.join('<span>%s</span>' % x for x in labels)))


def meter(name, pct):
    return '<div class="row"><div class="meter">%s<i style="--p:%d%%"></i></div><span class="pct">%%%d</span></div>' % (name, pct, pct)


WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

# --- Faydalar ---------------------------------------------------------------------------------------------------------
F1 = BAR + '<div class="pad"><div><div class="t">Maceralar</div><div class="muted">Nazlı · bugün 3 macera</div></div><div class="card">' \
    + row('Yatağını topla', '07:30') + row('Dişlerini fırçala', '08:00') + row('Kitap oku, 15 dakika', '20:30', False) \
    + '</div><div class="sec">Gelişim</div><div class="seg"><span>Günlük</span><span class="on">Haftalık</span><span>Aylık</span></div><div class="card">' \
    + bars([55, 70, 65, 85, 80, 95, 90], WEEK) + '</div></div>' + tabs('Maceralar')

F2 = BAR + '<div class="pad"><div class="muted c">Nazlı’nın tableti</div><div class="clock">20:00</div>' \
    '<div class="push"><img src="img/pofi-simge.png" alt=""><div><b>Pofi Adası · şimdi</b>Dişlerini fırçalama zamanı! Okti seni bekliyor.</div></div>' \
    '<div class="push"><img src="img/pofi-simge.png" alt=""><div><b>Pofi Adası · 19:30</b>Çantanı hazırlama zamanı.</div></div></div>'

F3 = BAR + '<div class="pad"><div><div class="t">Bugün</div><div class="muted">Nazlı</div></div>' \
    '<div class="pending"><div><small>Bugünün maceraları</small><b>5 maceranın 5’i tamam</b></div><span class="go">✓</span></div><div class="card">' \
    + row('Yatağını topla') + row('Dişlerini fırçala') + row('Çantanı hazırla') + row('Sofrayı kur') + row('Kitap oku, 15 dakika') \
    + '</div></div>' + tabs('Bugün')

F4 = BAR + '<div class="pad"><div><div class="t">Macera ekle</div><div class="muted">Nazlı için · <span class="pill">6–8 yaş</span></div></div>' \
    '<div class="chips"><span class="chip on">Ev İşleri</span><span class="chip">Öğrenme</span><span class="chip">Sağlık ve Spor</span><span class="chip">Odak</span><span class="chip">İlişki Kurma</span></div>' \
    '<div class="sec">Önerilenler</div><div class="card">' \
    + ''.join('<div class="row"><div class="grow"><b>%s</b></div><span class="plus">+</span></div>' % t for t in ['Yatağını topla', 'Sofrayı kur', 'Oyuncaklarını yerine koy', 'Bitkileri sula']) \
    + '</div></div>' + tabs('Maceralar')

# --- Nasıl çalışır ----------------------------------------------------------------------------------------------------
N1_ROWS = row('Dişlerini fırçala', '20:00') + row('Kitap oku, 15 dakika', '20:30') + row('Çantanı hazırla', '21:00')


def n1(live=False):
    cta = ('<button type="button" class="cta" data-act="add">3 macerayı ekle</button>' if live else '<div class="cta">3 macerayı ekle</div>')
    return BAR + '<div class="pad"><div><div class="t">Alanları seç</div><div class="muted">Nazlı için birkaç alan</div></div>' \
        '<div class="chips"><span class="chip on">Ev İşleri</span><span class="chip on">Sağlık ve Spor</span><span class="chip">Öğrenme</span><span class="chip on">Odak</span><span class="chip">İlişki Kurma</span></div>' \
        '<div class="sec">Yaşına uygun öneriler <span class="pill">6–8 yaş</span></div><div class="card">' + N1_ROWS + '</div>' + cta + '</div>'


def n2(live=False):
    btn = ('<button type="button" class="did" data-act="done">Yaptım</button>' if live else '<span class="did">Yaptım</span>')
    lock = ' lock' if live else ''
    return BAR + '<div class="shot"><img src="img/adalilar.jpg" alt="" width="1376" height="768"><span class="tag">Pofi Adası</span></div>' \
        '<div class="pad"><div class="sec">Bugünün macerası</div><div class="card"><div class="row"><div class="grow"><b>Dişlerini fırçala</b><div class="muted">20:00</div></div>' + btn + '</div></div>' \
        '<div class="sec">Okti’nin bakımı</div><div class="care%s"><span>Besle</span><span>Yıka</span><span>Büyüt</span></div>' % lock \
        + '<div class="muted c" data-carehint>%s</div></div>' % ('Macerayı tamamlayınca Okti’nin bakımı açılır.' if live else 'Her tamamlanan macera Okti’nin bakımını açar.')


def n3(live=False):
    top = ('<div class="card approve" data-approve><div class="row"><img class="av" src="img/okti_kiz_4.jpg" alt=""><div class="grow"><b>Dişlerini fırçala</b><div class="muted">Nazlı · 20:06</div></div>'
           '<button type="button" class="rbtn no" data-act="no" aria-label="Reddet">✕</button><button type="button" class="rbtn yes" data-act="ok" aria-label="Onayla">✓</button></div></div>' if live else '')
    vals = [80, 65, 50] if live else [90, 75, 60]
    return BAR + '<div class="pad"><div><div class="t">Gelişim</div><div class="muted">Nazlı · son 4 hafta</div></div>' + top \
        + '<div class="sec">Beceriler</div><div class="card" data-skills>' + meter('Sağlık ve Spor', vals[0]) + meter('Ev İşleri', vals[1]) + meter('Odak ve Öz Denetim', vals[2]) + '</div>' \
        '<div class="sec">Tamamlanan maceralar</div><div class="card">' + bars([40, 58, 76, 92], ['1. hafta', '2. hafta', '3. hafta', '4. hafta']) + '</div></div>' + tabs('Gelişim')


FAYDA = [F1, F2, F3, F4]
ADIM = [n1(), n2(), n3()]
ADIM_CANLI = [n1(True), n2(True), n3(True)]
EKRAN_SINIFI = {1: ' night'}  # Faydalar 2: çocuğun tableti, kilit ekranı


def telefon(ekranlar, sinif='', gizli=True, ek=''):
    """Üst üste dizili ekranlarla tek telefon; .on olan görünür."""
    ic = ''.join('<div class="screen%s%s" data-s="%d">%s</div>' % (EKRAN_SINIFI.get(i, '') if sinif == 'fayda' else '', ' on' if i == 0 else '', i, e) for i, e in enumerate(ekranlar))
    return '<div class="phone stack"%s>%s%s</div>' % (' aria-hidden="true"' if gizli else '', ic, ek)


def tek_telefon(ekran, i, sinif=''):
    return '<div class="phone" aria-hidden="true"><div class="screen%s">%s</div></div>' % (EKRAN_SINIFI.get(i, '') if sinif == 'fayda' else '', ekran)
