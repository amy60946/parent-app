// "A · Döngü" panoraması: 7 kare yan yana, tek zemin (lekeler ve kesik çizgi kareler arasında kesintisiz), durağan (animasyon yok).
// Kaynak tasarım: Moyo-A-Dongu.dc.html (402x874 kare). iPhone: 7x402x874 CSS @3x → 8442x2622; iPad: 7x1032x1376 CSS @2x → 14448x2752.
// Girdi: out/dongu/real/<cihaz>/*.png + meta.json (capture.js), img/oyun-*.webp (Moyo Oyun ekranları), out/fonts/poppins-*.woff2 (build.sh).
// Çıktı: out/dongu/panorama-<cihaz>.png (+ .html). slice.py 7 kareye böler.
// Kullanım: node store/dongu/render.js [iphone ipad]
//
// Büyütülmüş kart kuralları (her kare, iki cihaz; aşağıda otomatik denetlenir, biri bozulursa derleme durur):
//   1. Kart yalnız altındaki ekranda (2. karede oyun görselinde) gerçekten görünen metni gösterir: [data-t] parçaları meta.json metninde aranır,
//      değerler (%, saat, taş sayısı) meta.json'dan okunur.
//   2. Yeşil nokta kartın büyüttüğü öğeye değer; hiçbir yazının ya da simgenin üstüne binmez.
//   3. Kart hiçbir öğeyi yarım kapatmaz: altındaki her yazı, sayı, simge, düğme, çubuk ve satır ya tümüyle kartın altındadır ya da tümüyle görünür.
//      Tek istisna 1. kare iPhone: kart, büyüttüğü listenin satırlarının boş sağ yanına oturur (avatar ve düzenle düğmesi tümüyle altında).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, '../out/dongu');
const REAL = path.join(OUT, 'real');
const FONTS = path.join(__dirname, '../out/fonts');
const IMG = path.join(__dirname, 'img');
const url = (p) => 'file://' + p;

// Durum çubuğu: store/render.js'teki statusBar() (9:41, sinyal, Wi-Fi, dolu pil); renk ekranın üst renginden
const TOP = {};
const sbSrc = fs.readFileSync(path.join(__dirname, '../render.js'), 'utf8').match(/const statusBar = [\s\S]*?\n};/);
if (!sbSrc) throw new Error('store/render.js içinde statusBar bulunamadı');
const statusBar = new Function('TOP', `${sbSrc[0]}\nreturn statusBar;`)(TOP);
// Ekranın üst rengi (gerçek çekimin sol üst pikseli); koyu zeminde beyaz yazı
const topColor = (file) => execFileSync('python3', ['-I', '-c',
  'import sys;from PIL import Image;r,g,b=Image.open(sys.argv[1]).convert("RGB").getpixel((10,4));print("#%02X%02X%02X %d"%(r,g,b,(0.299*r+0.587*g+0.114*b)<140))', file]).toString().trim().split(' ');

/* ---------- Çekim bilgisi (meta.json): metin ve öğe kutuları, nokta cinsinden ---------- */
const metaOf = (dev) => {
  const all = JSON.parse(fs.readFileSync(path.join(REAL, dev, 'meta.json'), 'utf8'));
  const out = {};
  for (const [shot, m] of Object.entries(all)) {
    const items = m.items.map((i) => ({ ...i, x: i.r[0], y: i.r[1], w: i.r[2], h: i.r[3], x2: i.r[0] + i.r[2], y2: i.r[1] + i.r[3] }));
    const flat = m.text.replace(/\s+/g, ' ');
    const t = (text, n = 0) => { const a = items.filter((i) => i.k === 't' && i.t === text); if (!a[n]) throw new Error(`${dev}/${shot}: ekranda yok: "${text}"`); return a[n]; };
    // Öğeyi içine alan en küçük zeminli kutu (satır, kart); minW: en az genişlik
    const box = (it, minW = 0) => {
      const a = items.filter((i) => i.k === 'b' && i.w >= minW && i.x <= it.x + 0.5 && i.y <= it.y + 0.5 && i.x2 >= it.x2 - 0.5 && i.y2 >= it.y2 - 0.5).sort((p, q) => p.w * p.h - q.w * q.h);
      if (!a[0]) throw new Error(`${dev}/${shot}: kutu yok: "${it.t}"`);
      return a[0];
    };
    const re = (rx) => { const r = rx.exec(flat); if (!r) throw new Error(`${dev}/${shot}: metinde yok: ${rx}`); return r; };
    const label = (start) => { const a = items.find((i) => i.k === 'b' && (i.l || '').startsWith(start)); if (!a) throw new Error(`${dev}/${shot}: etiket yok: "${start}"`); return a; };
    out[shot] = { items, flat, squeezed: m.text.replace(/\s+/g, ''), t, box, re, label };
  }
  return out;
};
// 2. karedeki oyun görsellerinde (img/oyun-*.webp) okunan yazılar; kart yalnız bunları kullanır
const GAME_TEXT = ['Görevler', 'Maceralar', 'Ailenden', 'Dişlerini fırçala', 'Yaptım', 'Yapamam', 'Ailen bakıyor', 'Geri al', 'Oyun görevleri'];

/* ---------- Kareler ----------
   h / hb: başlık (hb: iPhone'da iki satıra bölünmüş hali; bütün başlıklar iki satır, ekranlar aynı hizada başlar)
   card(m): kart içeriği; [data-t] parçaları ekran metniyle doğrulanır
   place.<cihaz>(m, g): kartın yeri. l, r: kare içinde px. top, bottom: ekran noktası (bottom yoksa içerik kadar; out: cihazın alt kenarından px taşma).
     u: yazı ölçeği (alt ve üst belliyse sığan en büyük değer, en çok u). dot: ['top' | 'bottom', ekran x] ya da ['left', ekran y].
     align: kartta nokta hizasına gelecek öğe. free: yarım kapatılabilecek kutular (yalnız gerekçeli istisna). */
const T = (s) => `<span data-t>${s}</span>`;
const TICK = '<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
const SUN = '<svg class="sun" viewBox="0 0 24 24" fill="#E9B22B" stroke="#E9B22B" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="4.6" stroke="none"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8" fill="none"/></svg>';
const STEPS = ['Sabah yatağını topla', 'Ellerini yıka', 'Okul çantanı kaldır', 'Dişlerini fırçala'];

const FRAMES = [
  { shot: 'rutinler', h: 'Rutinleri birlikte planlayın', s: 'Hazır adımları seçin ya da kendiniz yazın.', alt: 'Rutinler ekranı',
    card: (m, dev) => {
      // Sıra ve durum ekrandan: adımlar yukarıdan aşağı, "Tamamlandı" olan işaretli
      const rows = STEPS.map((s) => m.t(s)).sort((a, b) => a.y - b.y);
      const done = m.items.filter((i) => i.k === 't' && i.t === 'Tamamlandı');
      const isDone = (r) => done.some((d) => d.y > r.y && d.y < r.y + 80);
      const row = (r) => `<div class="row${r.t === 'Dişlerini fırçala' ? ' on' : ''}"><span class="ck${isDone(r) ? ' y' : ''}">${isDone(r) ? TICK : ''}</span>${T(r.t)}</div>`;
      return `<p class="zt">${T('Rutinler')} · ${T('Sabah')}</p><div class="rows${dev === 'ipad' ? ' two' : ''}">${rows.map(row).join('')}</div>`;
    },
    cls: 'compact',
    place: {
      iphone: (m) => { const d = m.t('Dişlerini fırçala'); return { l: 196, r: 394, u: 1, dot: ['left', d.y + d.h / 2], align: '.row.on', free: (i) => i.w > 300 && i.h < 110 }; },
      ipad: (m, g) => { const row = m.box(m.t('Dişlerini fırçala'), 400); const fab = m.label('Rutin ekle'); return { l: g.X(36), r: 990, top: row.y2 + 8, bottom: fab.y - 14, u: 2.2, dot: ['top', 144] }; },
    } },
  { game: true, h: 'Çocuğunuz oyunda işaretler', s: 'Adımı gerçek hayatta yapar, Moyo Oyun\'da "Yaptım" der.',
    card: () => `<p class="zt" style="color:#FFFFFF">${T('Dişlerini fırçala')}</p>
<p class="zs" style="color:#D9D6EC">${T('Yaptım')} ${TICK}</p>
<p class="zs" style="color:#0FD354;font-weight:600;margin-top:.48em">${T('Ailen bakıyor')}</p>`, dark: true },
  { shot: 'onay', h: 'Son söz sizde', hb: 'Son söz<br>sizde', s: 'Onaylayın ya da "Tekrar dene" deyin.', alt: 'Onay ekranı',
    card: (m) => `<p class="zt">${T('Dişlerini fırçala')}</p>
<p class="zs">${T('Deniz')} · ${T(m.re(/Yaptım dedi: \d\d:\d\d/)[0])}</p>
<div class="btns"><span class="btn">${T('Tekrar dene')}</span><span class="btn p">${T('Onayla')}</span></div>`,
    // Kart karartılmış arka plandaki listeyi tümüyle örter, pencerenin hemen üstünde durur; pencerenin kendisi eksiksiz görünür
    place: {
      iphone: (m) => { const top = m.t('Adımı incele').y - 28; return { l: 47, r: 394, top: 2, bottom: top - 1.5, u: 1.3, dot: ['bottom', 195] }; },
      ipad: (m, g) => { const top = m.t('Adımı incele').y - 28; return { l: g.X(36), r: 990, top: m.t('Tümü').y - 24, bottom: top - 6, u: 2.7, dot: ['bottom', 384] }; },
    } },
  { shot: 'gelisim', h: 'Haftayı bir bakışta görün', s: 'Hangi adım ne kadar düzenli, tek ekranda.', alt: 'Gelişim ekranı',
    card: (m) => {
      const pct = m.re(/Dişlerini fırçala % (\d+)/)[1];
      return `<p class="ze">${T('Alışkanlıklar · son 4 hafta')}</p>
<div class="kv"><p class="zt">${T('Dişlerini fırçala')}</p><p class="zt">${T('%' + pct)}</p></div>
<div class="bar"><i style="width:${pct}%"></i></div>`;
    },
    // Kart son satırın ("Dişlerini fırçala") hemen altında: dipnotu ve sekme çubuğunu tümüyle örter, alışkanlık satırlarının dördü de görünür
    place: {
      iphone: (m) => { const b = m.box(m.t('Alışkanlıklar · son 4 hafta'), 300); return { l: 47, r: 394, top: b.y2 + 3, out: 14, u: 1.3, dot: ['top', 82] }; },
      ipad: (m, g) => { const b = m.box(m.t('Alışkanlıklar · son 4 hafta'), 400); return { l: g.X(36), r: 990, top: b.y2 + 3, out: 16, u: 2.7, dot: ['top', 105] }; },
    } },
  { shot: 'davranis', h: 'Zorlandığı anı not edin', s: 'Ne oldu, öncesi, sonrası: kısa bir not yeter.', alt: 'Davranış kayıtları ekranı',
    card: (m) => {
      const r = m.re(/(\d+ \S+ \d{4}) · (\S+) Şiddet \d \/5 \S+ Öncesinde : (.+?) Ne oldu : (.+?) Sonrasında : (.+?) 🩺/);
      return `<p class="zt">${T(r[1])} · ${T(r[2])}</p>
<p class="zl"><b>${T('Öncesinde')}:</b> ${T(r[3])}</p>
<p class="zl"><b>${T('Ne oldu')}:</b> ${T(r[4])}</p>
<p class="zl"><b>${T('Sonrasında')}:</b> ${T(r[5])}</p>`;
    },
    // Kart en üstteki kaydın (alıntıladığı kayıt) hemen altında; altındaki kaydı (iPad'de iki kaydı) tümüyle örter
    place: {
      iphone: (m) => { const a = m.box(m.t('18 Kasım 2026'), 300), c = m.box(m.t('7 Kasım 2026'), 300); return { l: 47, r: 394, top: a.y2 + 5, bottom: c.y - 5, u: 1.3, dot: ['top', 300] }; },
      ipad: (m, g) => { const a = m.box(m.t('18 Kasım 2026'), 400), c = m.box(m.t('2 Kasım 2026'), 400); return { l: g.X(32), r: 990, top: a.y2 + 5, bottom: c.y - 5, u: 2.7, dot: ['top', 560] }; },
    } },
  { shot: 'uzman', h: 'Uzmanınızla paylaşın', hb: 'Uzmanınızla<br>paylaşın', s: 'Yalnız izin verdiğinizde; izni her an geri alırsınız.', alt: 'Uzmanım ekranı',
    card: () => `<p class="ze">${T('Rutin ve adım önerileri')}</p>
<p class="zt">${T('Yatmadan önce kitap oku')}</p>
<p class="zs">${T('Yatmadan önce 10 dakika birlikte kitap okuyun.')}</p>
<div class="btns eq"><span class="btn">${T('Şimdilik değil')}</span><span class="btn p">${T('Rutinlere ekle')}</span></div>`,
    // Kart önerinin hemen üstünde: "Randevular" ve "Bugün yapılacaklar" bölümlerini tümüyle örter; öneri ve paylaşım bölümü eksiksiz görünür
    place: {
      iphone: (m) => { const hd = m.box(m.t('Elif Örnek'), 300); return { l: 47, r: 394, top: hd.y2 + 8, bottom: m.t('Rutin ve adım önerileri').y - 8, u: 1.3, dot: ['bottom', 300] }; },
      ipad: (m, g) => { const hd = m.box(m.t('Elif Örnek'), 400); return { l: g.X(36), r: 990, top: hd.y2 + 8, bottom: m.t('Rutin ve adım önerileri').y - 8, u: 2.7, dot: ['bottom', 520] }; },
    } },
  { shot: 'oduller', h: 'Ödülleri siz belirlersiniz', s: 'Onayladığınız adımlar Güneş Taşı kazandırır.', alt: 'Ödüller ekranı', night: true,
    card: (m) => {
      const cost = m.re(/Hafta sonu parka gitmek (\d+ Güneş Taşı)/)[1];
      const bal = m.re(/D Deniz \S* ?(\d+)/)[1];
      return `<p class="zt">${T('Hafta sonu parka gitmek')}</p>
<div class="kv" style="margin-top:.5em"><p class="zs" style="margin:0">${T(cost)}</p><span class="chip"><span class="av">${T('D')}</span>${T('Deniz')}${SUN}${T(bal)}</span></div>`;
    },
    // Kart listenin son satırının ("Hafta sonu parka gitmek") hemen altındaki boşlukta; hiçbir şeyi örtmez
    place: {
      iphone: (m) => { const row = m.box(m.t('Hafta sonu parka gitmek'), 300); return { l: 47, r: 394, top: row.y2 + 8, u: 1.3, dot: ['top', 120] }; },
      ipad: (m, g) => { const row = m.box(m.t('Hafta sonu parka gitmek'), 400); return { l: g.X(32), r: 990, top: row.y2 + 8, u: 2.7, dot: ['top', 190] }; },
    } },
];

/* ---------- Cihaz düzenleri ----------
   z: nokta, etiket ve gölgenin ölçeği (iPhone = tasarım = 1). scrY: ekranın üst kenarı, yedi karede aynı (başlık 2 satır + alt başlık en çok 2 satır).
   iPad: 768x1024 nokta ekran 780 px genişlikte (uygulama yazısı eski 1024 noktalık çekime göre %41 büyük), ekranın tamamı görünür. */
const DEV = {
  iphone: {
    FW: 402, FH: 874, dpr: 3, pt: 390, ptH: 844, sbPt: 54, z: 1,
    pad: '46px 30px 0', gap: 10, h: 31, s: 15, sMax: 330,
    scrW: 270, bw: 6, rad: 32, scrX: 36, scrY: 188, sb: (k, shot) => statusBar(k, shot),
    land: { w: 330, bw: 6, rad: 22, gap: 56, u: 1.25 },
  },
  ipad: {
    FW: 1032, FH: 1376, dpr: 2, pt: 768, ptH: 1024, sbPt: 28, z: 1.85,
    pad: '80px 64px 0', gap: 18, h: 60, s: 27, sMax: 880,
    scrW: 780, bw: 12, rad: 44, scrX: 64, scrY: 240,
    // iPad durum çubuğu daha alçak: aynı çizim, yükseklik 28 nokta, yanlarda 20 nokta boşluk
    sb: (k, shot) => statusBar(k * 0.62, shot).replace(/height:[\d.]+px/, `height:${28 * k}px`).replace(/padding:0 [\d.]+px 0 [\d.]+px/, `padding:0 ${20 * k}px 0 ${22 * k}px`),
    land: { w: 800, bw: 10, rad: 38, gap: 110, u: 2.6 },
  },
};

// Zemin lekeleri ve kesik çizgi: tasarımın 2814x874 panoramasındaki yerleri, cihazın panoramasına ölçeklenir
const BLOBS = [[520, -120, 360, '#DCD8F3'], [440, 620, -140, '#D5F2E0'], [560, 1300, 420, '#DCD8F3'], [460, 2000, -160, '#D5F2E0'], [500, 2500, 430, '#DCD8F3']];
const PATH = 'M 300 470 C 420 560, 560 330, 700 500 S 940 600, 1100 470 S 1350 360, 1500 500 S 1760 620, 1910 470 S 2150 380, 2300 500 S 2560 600, 2720 470';
// Oyun görseli 1200x554; ikinci görselde "Dişlerini fırçala … Ailen bakıyor" satırı y 372–468, liste paneli x 55–832, sağ panel x 845'ten
const GAME = { w: 1200, h: 554, rowBottom: 474, cardL: 30, cardR: 836, dotX: 500 };

function page(dev, meta) {
  const d = DEV[dev], z = d.z, n = FRAMES.length, PW = d.FW * n;
  const sx = PW / 2814, sy = d.FH / 874, sr = Math.sqrt(sx * sy);
  const k = d.scrW / d.pt; // CSS px / uygulama noktası
  const sbH = d.sbPt * k;
  const g = { k, X: (x) => d.scrX + d.bw + x * k, Y: (y) => d.scrY + d.bw + sbH + y * k, bottom: d.scrY + 2 * d.bw + sbH + d.ptH * k };
  let xy = 0;
  const scaled = PATH.replace(/-?\d+(\.\d+)?/g, (v) => (xy++ % 2 ? +v * sy : +v * sx).toFixed(1));
  const font = (w) => ['latin', 'latin-ext'].map((sub) => `@font-face{font-family:Poppins;font-style:normal;font-weight:${w};src:url('${url(path.join(FONTS, `poppins-${sub}-${w}-normal.woff2`))}') format('woff2');unicode-range:${sub === 'latin'
    ? 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
    : 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'}}`).join('\n');
  const px = (v) => `${+(v * z).toFixed(2)}px`;
  const U = (v) => `calc(${v} * var(--u))`; // kartın kendi ölçeği
  const css = `${[600, 700, 800].map(font).join('\n')}
*{box-sizing:border-box}
html,body{margin:0;background:#EEF0FB}
body{width:${PW}px;height:${d.FH}px;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#16113A;-webkit-font-smoothing:antialiased}
.pano{display:flex;position:relative;overflow:hidden;background:#EEF0FB;width:${PW}px;height:${d.FH}px}
.blob{position:absolute;border-radius:50%;z-index:0}
.line{position:absolute;left:0;top:0;z-index:1;pointer-events:none}
.fr{width:${d.FW}px;height:${d.FH}px;padding:${d.pad};display:flex;flex-direction:column;align-items:center;gap:${d.gap}px;position:relative;flex:none}
.fr.night{background:#16113A}
.h{margin:0;font-family:Poppins,sans-serif;font-weight:800;font-size:${d.h}px;line-height:1.1;letter-spacing:-0.015em;text-align:center;color:#16113A;position:relative;z-index:2;text-wrap:balance}
.s{margin:0;font-size:${d.s}px;line-height:1.42;text-align:center;max-width:${d.sMax}px;color:#3D3858;position:relative;z-index:2;text-wrap:balance}
.night .h{color:#FFFFFF}.night .s{color:#D9D6EC}
.scr{position:absolute;left:${d.scrX}px;top:${d.scrY}px;width:${d.scrW + 2 * d.bw}px;border-radius:${d.rad}px;overflow:hidden;border:${d.bw}px solid #16113A;background:#FFFFFF;z-index:2}
.night .scr{border-color:#FFFFFF}
.scr img{display:block;width:100%;height:auto}
.sb{display:flex;align-items:center;justify-content:space-between;font-weight:600;letter-spacing:-.2px;font-family:Inter,system-ui,sans-serif}
.land{position:absolute;width:${d.land.w + 2 * d.land.bw}px;border-radius:${d.land.rad}px;overflow:hidden;border:${d.land.bw}px solid #16113A;z-index:2}
.land img{display:block;width:100%;height:auto}
.tag{position:absolute;z-index:2;transform:translate(-50%,-50%);white-space:nowrap;font-size:${px(12)};font-weight:600;letter-spacing:.04em;padding:${px(5)} ${px(10)};border-radius:999px;background:#16113A;color:#FFFFFF}
.dot{position:absolute;z-index:5;width:${px(18)};height:${px(18)};border-radius:50%;background:#0FD354;border:${px(3)} solid #FFFFFF;box-shadow:0 0 0 ${px(5)} rgba(15,211,84,.22)}
.zoom{position:absolute;z-index:4;display:flex;flex-direction:column;justify-content:center;background:#FFFFFF;border-radius:${U(20)};border:${U(3)} solid #0FD354;padding:${U(14)} ${U(16)};box-shadow:0 ${px(20)} ${px(44)} rgba(22,17,58,.24)}
.zoom.dark{background:#16113A}
.zoom p{margin:0}
.zt{font-family:Poppins,sans-serif;font-weight:700;font-size:${U(17)};line-height:1.3;color:#16113A;white-space:nowrap}
.zs{font-size:${U(12.5)};line-height:1.4;color:#5B5677;margin-top:${U(2)} !important;white-space:nowrap}
.ze{font-size:${U(11.5)};line-height:1.4;font-weight:600;color:#5B5677;margin-bottom:${U(2)} !important;white-space:nowrap}
.zl{font-size:${U(12.5)};line-height:1.45;color:#3D3858;margin-top:${U(3)} !important}
.zl b{font-weight:600;color:#16113A}
.kv{display:flex;align-items:center;justify-content:space-between;gap:${U(10)}}
.bar{height:${U(7)};border-radius:999px;background:#E3E0F0;margin-top:${U(8)};overflow:hidden}
.bar i{display:block;height:100%;border-radius:999px;background:#16113A}
.zoom.compact{padding:${U(14)} ${U(14)}}.compact .zt{font-size:${U(16)}}
.row{display:flex;align-items:center;gap:${U(10)};padding:${U(7)} 0;border-bottom:${U(1)} solid #EEF0FB;font-size:${U(13.5)};line-height:1.35;color:#3D3858;white-space:nowrap}
.row.on{color:#16113A;font-weight:600;background:#E7F8EE;margin:0 ${U(-8)};padding:${U(7)} ${U(8)};border-radius:${U(10)};border-bottom:none}
.row:last-child{border-bottom:none}
.rows.two{display:grid;grid-template-columns:1fr 1fr;column-gap:${U(26)};margin-top:${U(4)}}
.rows.two .row:nth-last-child(-n+2){border-bottom:none}
.rows.two .row.on{margin:0 ${U(-8)}}
.ck{width:${U(18)};height:${U(18)};border-radius:${U(6)};border:${U(2)} solid #B9B5D6;flex:none;display:flex;align-items:center;justify-content:center;color:#FFFFFF}
.ck.y{background:#0FD354;border-color:#0FD354}
.ck .tick{width:${U(12)};height:${U(12)};margin:0}
.tick{display:inline-block;width:.95em;height:.95em;vertical-align:-.12em;margin-left:.1em}
.btns{display:flex;gap:${U(8)};margin-top:${U(10)}}
.btn{font-size:${U(13)};line-height:1.3;font-weight:600;padding:${U(8)} ${U(12)};border-radius:999px;border:${U(2)} solid #16113A;color:#16113A;background:#FFFFFF;white-space:nowrap;text-align:center}
.btn.p{background:#16113A;color:#FFFFFF}
.btns.eq .btn{flex:1}
.chip{display:inline-flex;align-items:center;gap:${U(5)};padding:${U(3)} ${U(10)} ${U(3)} ${U(3)};border-radius:999px;background:#F1F2F6;font-size:${U(12.5)};line-height:1.4;font-weight:700;color:#16113A;white-space:nowrap}
.chip .av{width:${U(20)};height:${U(20)};border-radius:50%;background:#FDE7EA;color:#C4283B;display:flex;align-items:center;justify-content:center;font-size:${U(11)}}
.chip .sun{width:${U(13)};height:${U(13)};margin-left:${U(3)}}`;

  const blobs = BLOBS.map(([s, l, t, c]) => `<span class="blob" style="width:${s * sr}px;height:${s * sr}px;left:${l * sx}px;top:${t * sy}px;background:${c}"></span>`).join('');
  const line = `<svg class="line" width="${PW}" height="${d.FH}" viewBox="0 0 ${PW} ${d.FH}"><path d="${scaled}" fill="none" stroke="#16113A" stroke-width="${3 * z}" stroke-dasharray="${12 * z} ${14 * z}" opacity="0.3"/></svg>`;
  const places = [];
  const frames = FRAMES.map((f, i) => {
    let mid, pl;
    if (f.game) {
      // İki oyun görseli; ilki öteki karelerdeki ekranlarla aynı hizada başlar. Kart ikinci görselde büyüttüğü satırın hemen altında:
      // liste panelinin boş alt kenarını örter, sağdaki "Oyun görevleri" paneline ve hiçbir satıra değmez.
      const L = d.land, lx = (d.FW - L.w - 2 * L.bw) / 2, lh = L.w * GAME.h / GAME.w + 2 * L.bw, y2 = d.scrY + lh + L.gap, s = L.w / GAME.w;
      mid = `<div class="land" style="left:${lx}px;top:${d.scrY}px"><img src="${url(path.join(IMG, 'oyun-maceralar.webp'))}" alt="Moyo Oyun adım listesi"></div>
<span class="tag" style="left:${d.FW / 2}px;top:${d.scrY + lh + L.gap / 2}px">Moyo Oyun ekranı</span>
<div class="land" style="left:${lx}px;top:${y2}px"><img src="${url(path.join(IMG, 'oyun-onay-bekliyor.webp'))}" alt="Moyo Oyun onay bekleyen adım"></div>`;
      pl = { l: lx + L.bw + GAME.cardL * s, r: lx + L.bw + GAME.cardR * s, topPx: y2 + L.bw + GAME.rowBottom * s, u: L.u, dotPx: ['top', lx + L.bw + GAME.dotX * s] };
    } else {
      const file = path.join(REAL, dev, `${f.shot}.png`);
      const [bg, dark] = topColor(file);
      TOP[f.shot] = [bg, dark === '1' ? '#FFFFFF' : '#0F1B3D'];
      mid = `<div class="scr">${d.sb(k, f.shot)}<img src="${url(file)}" alt="${f.alt}"></div>`;
      const p = f.place[dev](meta[f.shot], g);
      pl = { ...p, topPx: p.top == null ? null : g.Y(p.top), bottomPx: p.out != null ? g.bottom + p.out : p.bottom != null ? g.Y(p.bottom) : null,
        dotPx: p.dot[0] === 'left' ? ['left', g.Y(p.dot[1])] : [p.dot[0], g.X(p.dot[1])] };
    }
    places.push(pl);
    const card = `<div class="zoom${f.dark ? ' dark' : ''}${f.cls ? ' ' + f.cls : ''}" style="left:${pl.l}px;width:${pl.r - pl.l}px;--u:${pl.u}px" data-u="${pl.u}" data-top="${pl.topPx ?? ''}" data-bottom="${pl.bottomPx ?? ''}" data-align="${pl.align || ''}" data-dot="${pl.dotPx.join(',')}">${f.card(f.game ? null : meta[f.shot], dev)}</div>`;
    const head = dev === 'iphone' && f.hb ? f.hb : f.h;
    return `<div class="fr${f.night ? ' night' : ''}"><p class="h">${head}</p><p class="s">${f.s}</p>${mid}<span class="dot"></span>${card}</div>`;
  }).join('\n');

  // Kart ölçeği: üstü ve altı belli kartta, içerik taşmadan sığan en büyük ölçek. Sonra nokta kartın kenarına oturur.
  const script = `document.fonts.ready.then(() => {
  document.querySelectorAll('.fr').forEach((fr) => {
    const card = fr.querySelector('.zoom'), dot = fr.querySelector('.dot'), q = card.dataset;
    const [edge, pos] = q.dot.split(',');
    const over = () => [...card.querySelectorAll('.zt,.zs,.ze,.row,.btns,.kv,.chip')].some((e) => e.scrollWidth > e.clientWidth + 0.5);
    let top = q.top === '' ? null : +q.top;
    if (q.bottom !== '') {
      const H = +q.bottom - top;
      let u = +q.u;
      for (; u > 0.5; u -= 0.01) { card.style.setProperty('--u', u + 'px'); if (card.offsetHeight <= H && !over()) break; }
      card.dataset.fit = u.toFixed(2);
      card.style.height = H + 'px';
    }
    if (q.align) { const a = card.querySelector(q.align); top = +pos - (a.offsetTop + a.offsetHeight / 2) - card.clientTop; }
    card.style.top = top + 'px';
    const r = dot.offsetWidth / 2;
    const cx = edge === 'left' ? card.offsetLeft : +pos, cy = edge === 'left' ? +pos : edge === 'top' ? top : top + card.offsetHeight;
    dot.style.left = (cx - r) + 'px'; dot.style.top = (cy - r) + 'px';
  });
  document.body.dataset.ready = '1';
});`;
  return { g, places, html: `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Moyo A Döngü ${dev}</title><style>${css}</style></head>
<body><div class="pano">${blobs}${line}${frames}</div><script>${script}</script></body></html>` };
}

(async () => {
  const which = process.argv.slice(2).length ? process.argv.slice(2) : ['iphone', 'ipad'];
  const b = await chromium.launch();
  for (const dev of which) {
    const d = DEV[dev], meta = metaOf(dev);
    const { g, places, html } = page(dev, meta);
    const file = path.join(OUT, `panorama-${dev}.html`);
    fs.writeFileSync(file, html);
    const p = await b.newPage({ viewport: { width: d.FW * FRAMES.length, height: d.FH }, deviceScaleFactor: d.dpr });
    await p.goto(url(file));
    await p.waitForFunction(() => document.body.dataset.ready === '1');
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await p.waitForTimeout(500);
    const bad = [];
    // Denetim 1: Poppins (latin-ext dahil) yüklendi mi, kart metni taşmıyor mu, kartlar karenin içinde mi, başlıklar ve ekranlar hizalı mı
    const lay = await p.evaluate(() => {
      const R = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, x2: r.right, y2: r.bottom }; };
      const tr = document.fonts.check('800 31px Poppins', 'ığşİçöü');
      const over = [...document.querySelectorAll('.zoom .zt,.zoom .zs,.zoom .ze,.zoom .row,.zoom .btns,.zoom .kv,.zoom .chip,.zoom')].filter((e) => e.scrollWidth > e.clientWidth + 1 || (e.classList.contains('zoom') && e.scrollHeight > e.clientHeight + 1))
        .map((e) => `${e.className} ${e.scrollWidth}>${e.clientWidth} ${e.scrollHeight}>${e.clientHeight} ${e.textContent.trim().slice(0, 30)}`);
      const frames = [...document.querySelectorAll('.fr')].map((fr) => {
        const card = fr.querySelector('.zoom'), dot = fr.querySelector('.dot'), dev = fr.querySelector('.scr') || fr.querySelector('.land');
        const texts = [...card.querySelectorAll('[data-t]')].map((e) => e.textContent);
        const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT); let loose = '';
        for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement.closest('[data-t]')) loose += n.textContent;
        const lines = (e) => Math.round(e.offsetHeight / parseFloat(getComputedStyle(e).lineHeight));
        return { fr: R(fr), card: R(card), dot: R(dot), dev: R(dev), h: R(fr.querySelector('.h')), s: R(fr.querySelector('.s')), hl: lines(fr.querySelector('.h')), sl: lines(fr.querySelector('.s')),
          fit: card.dataset.fit || card.dataset.u, texts, loose: loose.replace(/[\s·:]/g, '') };
      });
      return { tr, over, frames };
    });
    if (!lay.tr) bad.push('Poppins Türkçe harfler yüklenmedi');
    if (lay.over.length) bad.push(`kart metni taşıyor: ${JSON.stringify(lay.over)}`);
    const k = g.k, e = 0.75;
    lay.frames.forEach((F, i) => {
      const f = FRAMES[i], name = `${dev} kare ${i + 1}`, ox = i * d.FW;
      if (F.card.x < F.fr.x + 2 || F.card.x2 > F.fr.x2 - 2 || F.card.y2 > F.fr.y2 - 2 || F.dev.y2 > F.fr.y2 - 2) bad.push(`${name}: kart ya da ekran karenin dışında`);
      if (Math.abs(F.dev.y - d.scrY) > 0.5) bad.push(`${name}: ekran üst kenarı ${F.dev.y} (beklenen ${d.scrY})`);
      if (F.hl !== lay.frames[0].hl || Math.abs(F.h.y - lay.frames[0].h.y) > 0.5 || Math.abs(F.s.y - lay.frames[0].s.y) > 0.5) bad.push(`${name}: başlık hizası farklı (${F.hl} satır)`);
      if (F.s.y2 > d.scrY - 12 * d.z) bad.push(`${name}: alt başlık ekrana çok yakın`);
      if (F.loose) bad.push(`${name}: kartta doğrulanmamış metin "${F.loose}"`);
      const sq = f.game ? null : meta[f.shot].squeezed;
      F.texts.forEach((t) => { if (f.game ? !GAME_TEXT.includes(t) : !sq.includes(t.replace(/\s+/g, ''))) bad.push(`${name}: kart metni ekranda yok: "${t}"`); });
      const info = [`u=${F.fit}`, `kart ${Math.round(F.card.x2 - F.card.x)}x${Math.round(F.card.y2 - F.card.y)}`, JSON.stringify(F.texts)];
      if (!f.game) {
        // Denetim 2: kartın altındaki her öğe ya tümüyle örtülü ya tümüyle görünür; nokta yazıya ya da simgeye binmiyor
        const pl = places[i];
        const c = { x: (F.card.x - ox - g.X(0)) / k, x2: (F.card.x2 - ox - g.X(0)) / k, y: (F.card.y - g.Y(0)) / k, y2: (F.card.y2 - g.Y(0)) / k };
        if (c.y < 0) bad.push(`${name}: kart durum çubuğuna taşıyor`);
        const dc = { x: ((F.dot.x + F.dot.x2) / 2 - ox - g.X(0)) / k, y: ((F.dot.y + F.dot.y2) / 2 - g.Y(0)) / k, r: (F.dot.x2 - F.dot.x) / 2 / k + 1 };
        let covered = 0;
        for (const it of meta[f.shot].items) {
          if (it.x2 <= 0 || it.x >= d.pt || it.y2 <= 0 || it.y >= d.ptH) continue;
          const lab = `${it.k} "${it.t || it.l || it.c || ''}" [${Math.round(it.x)}–${Math.round(it.x2)}, ${Math.round(it.y)}–${Math.round(it.y2)}]`;
          if (it.k !== 'b') { // nokta
            const nx = Math.max(it.x, Math.min(dc.x, it.x2)), ny = Math.max(it.y, Math.min(dc.y, it.y2));
            const inCard = it.x >= c.x - 0.5 && it.x2 <= c.x2 + 0.5 && it.y >= c.y - 0.5 && it.y2 <= c.y2 + 0.5;
            if (!inCard && (nx - dc.x) ** 2 + (ny - dc.y) ** 2 < dc.r ** 2) bad.push(`${name}: nokta öğenin üstünde: ${lab}`);
          }
          if (it.k === 'b' && (it.h >= 240 || it.w >= d.pt * 0.97)) continue; // ekran zemini, büyük kap
          const inter = !(it.x2 <= c.x + e || it.x >= c.x2 - e || it.y2 <= c.y + e || it.y >= c.y2 - e);
          if (!inter) continue;
          const inside = it.x >= c.x - 0.5 && it.x2 <= c.x2 + 0.5 && it.y >= c.y - 0.5 && it.y2 <= c.y2 + 0.5;
          if (inside) { covered++; continue; }
          if (it.k === 'b' && pl.free && pl.free(it)) continue;
          bad.push(`${name}: kart yarım kapatıyor: ${lab}`);
        }
        info.push(`örtülen öğe ${covered}`, `kart nokta [${Math.round(c.x)}–${Math.round(c.x2)}, ${Math.round(c.y)}–${Math.round(c.y2)}]`);
      }
      console.log(' ', name, info.join(' · '));
    });
    if (bad.length) { console.log(bad.map((x) => '✗ ' + x).join('\n')); process.exitCode = 1; }
    await p.screenshot({ path: path.join(OUT, `panorama-${dev}.png`), fullPage: false });
    await p.close();
    console.log(bad.length ? '✗' : '✓', dev);
  }
  await b.close();
})();
