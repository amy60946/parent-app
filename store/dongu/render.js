// "A · Döngü" panoraması: 7 kare yan yana, tek zemin (lekeler ve kesik çizgi kareler arasında kesintisiz), durağan (animasyon yok).
// Kaynak tasarım: Moyo-A-Dongu.dc.html (402x874 kare). iPhone: 7x402x874 CSS @3x → 8442x2622; iPad: 7x1032x1376 CSS @2x → 14448x2752.
// Girdi: out/dongu/real/<cihaz>/*.png (capture.js), img/oyun-*.webp (Moyo Oyun ekranları), out/fonts/poppins-*.woff2 (build.sh).
// Çıktı: out/dongu/panorama-<cihaz>.png (+ .html). slice.py 7 kareye böler.
// Kullanım: node store/dongu/render.js [iphone ipad]
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

/* ---------- Metinler (tasarımla aynı; 6. kartın düğmeleri ve 7. karenin alt satırı gerçeğe göre) ---------- */
const FRAMES = [
  { shot: 'rutinler', h: 'Rutinleri birlikte planlayın', s: 'Hazır adımları seçin ya da kendiniz yazın.', alt: 'Rutinler ekranı',
    card: `<p class="zt">Sabah rutini · 4 adım</p>
<div class="row"><span class="ck y"></span>Sabah yatağını topla</div>
<div class="row on"><span class="ck"></span>Dişlerini fırçala</div>
<div class="row"><span class="ck"></span>Ellerini yıka</div>
<div class="row" style="border-bottom:none"><span class="ck"></span>Okul çantanı kaldır</div>`, dot: '.row.on', cls: 'compact' },
  { game: true, h: 'Çocuğunuz oyunda işaretler', s: 'Adımı gerçek hayatta yapar, Moyo Oyun\'da "Yaptım" der.',
    card: `<p class="zt" style="color:#FFFFFF">Dişlerini fırçala</p>
<p class="zs" style="color:#D9D6EC">Sabah macerası · Yaptım ✓</p>
<p class="zs" style="color:#0FD354;font-weight:600;margin-top:.48em">Ailenin onayını bekliyor</p>`, dark: true },
  { shot: 'onay', h: 'Son söz sizde', s: 'Onaylayın ya da "Tekrar dene" deyin.', alt: 'Onay ekranı',
    card: `<p class="zt">Dişlerini fırçala</p>
<p class="zs">Deniz · 08:10'da yaptı</p>
<div class="btns"><span class="btn">Tekrar dene</span><span class="btn p">Onayla</span></div>` },
  { shot: 'gelisim', h: 'Haftayı bir bakışta görün', s: 'Hangi adım hangi gün yapıldı, tek ekranda.', alt: 'Gelişim ekranı',
    card: `<p class="zt">Dişlerini fırçala</p>
<p class="zs">Bu hafta · 6 gün</p>
<div class="d7"><span></span><span></span><span></span><span class="x"></span><span></span><span></span><span></span></div>` },
  { shot: 'davranis', h: 'Zorlandığı anı not edin', s: 'Ne oldu, öncesi, sonrası: kısa bir not yeter.', alt: 'Davranış kayıtları ekranı',
    card: `<p class="zt">Akşam · diş fırçalama</p>
<p class="zs">Öncesi: ekran süresi bitti</p>
<p class="zs">Sonrası: birlikte fırçaladık</p>` },
  { shot: 'uzman', h: 'Uzmanınızla paylaşın', s: 'Yalnız izin verdiğinizde; izni her an geri alırsınız.', alt: 'Uzmanım ekranı',
    card: `<p class="zt">Uzmanınız önerdi</p>
<p class="zs">Yatmadan önce kitap oku</p>
<div class="btns"><span class="btn">Şimdilik değil</span><span class="btn p">Rutinlere ekle</span></div>` },
  { shot: 'oduller', h: 'Ödülleri siz belirlersiniz', s: 'Onayladığınız adımlar Güneş Taşı kazandırır.', alt: 'Ödüller ekranı', night: true,
    card: `<p class="zt">Dişlerini fırçala</p>
<p class="zs">Onaylandı · +1 Güneş Taşı</p>
<p class="zs" style="color:#16113A;font-weight:600;margin-top:.48em">Ödül: hafta sonu parka gitmek</p>` },
];

/* ---------- Cihaz düzenleri ----------
   z: kart, nokta ve küçük yazıların ölçeği (iPhone = tasarım = 1)
   zoom[i]: [sol (CSS px, kare içinde), üst (ekranın uygulama noktası; oyun karesinde alt görselden uzaklık), genişlik] */
const DEV = {
  iphone: {
    FW: 402, FH: 874, dpr: 3, pt: 390, ptH: 844, z: 1,
    pad: '46px 30px 0', gap: 10, h: 31, s: 15, sMax: 330,
    scrW: 270, bw: 6, rad: 32, scrTop: 16, scrLeft: 6, sb: (k, shot) => statusBar(k, shot),
    landW: 330, landBw: 6, landRad: 22, landTop: 30,
    zoom: [[190, 313, 205], [70, 22, 262], [152, 24, 240], [150, 418, 242], [150, 432, 242], [114, 124, 278], [150, 438, 242]],
  },
  ipad: {
    FW: 1032, FH: 1376, dpr: 2, pt: 1024, ptH: 1366, z: 1.85,
    pad: '92px 64px 0', gap: 18, h: 60, s: 27, sMax: 820,
    scrW: 690, bw: 12, rad: 46, scrTop: 40, scrLeft: 12,
    // iPad durum çubuğu daha alçak: aynı çizim, yükseklik 28 nokta, yanlarda 20 nokta boşluk
    sb: (k, shot) => statusBar(k * 0.62, shot).replace(/height:[\d.]+px/, `height:${28 * k}px`).replace(/padding:0 [\d.]+px 0 [\d.]+px/, `padding:0 ${20 * k}px 0 ${22 * k}px`),
    landW: 640, landBw: 10, landRad: 36, landTop: 52,
    zoom: [[470, 700, 470], [210, 40, 500], [470, 150, 450], [470, 860, 460], [470, 900, 460], [430, 900, 520], [470, 640, 460]],
  },
};

// Zemin lekeleri ve kesik çizgi: tasarımın 2814x874 panoramasındaki yerleri, cihazın panoramasına ölçeklenir
const BLOBS = [[520, -120, 360, '#DCD8F3'], [440, 620, -140, '#D5F2E0'], [560, 1300, 420, '#DCD8F3'], [460, 2000, -160, '#D5F2E0'], [500, 2500, 430, '#DCD8F3']];
const PATH = 'M 300 470 C 420 560, 560 330, 700 500 S 940 600, 1100 470 S 1350 360, 1500 500 S 1760 620, 1910 470 S 2150 380, 2300 500 S 2560 600, 2720 470';

function page(dev) {
  const d = DEV[dev], z = d.z, n = FRAMES.length, PW = d.FW * n;
  const sx = PW / 2814, sy = d.FH / 874, sr = Math.sqrt(sx * sy);
  const k = d.scrW / d.pt; // CSS px / uygulama noktası
  const sbH = parseFloat(d.sb(k, '').match(/height:([\d.]+)px/)[1]);
  let xy = 0;
  const scaled = PATH.replace(/-?\d+(\.\d+)?/g, (v) => (xy++ % 2 ? +v * sy : +v * sx).toFixed(1));
  const font = (w) => ['latin', 'latin-ext'].map((sub) => `@font-face{font-family:Poppins;font-style:normal;font-weight:${w};src:url('${url(path.join(FONTS, `poppins-${sub}-${w}-normal.woff2`))}') format('woff2');unicode-range:${sub === 'latin'
    ? 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
    : 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'}}`).join('\n');
  const px = (v) => `${+(v * z).toFixed(2)}px`;
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
.scr{margin-top:${d.scrTop}px;width:${d.scrW + 2 * d.bw}px;border-radius:${d.rad}px;overflow:hidden;border:${d.bw}px solid #16113A;background:#FFFFFF;flex:none;position:relative;z-index:2;align-self:flex-start;margin-left:${d.scrLeft}px}
.night .scr{border-color:#FFFFFF}
.scr img{display:block;width:100%;height:auto}
.sb{display:flex;align-items:center;justify-content:space-between;font-weight:600;letter-spacing:-.2px;font-family:Inter,system-ui,sans-serif}
.land{margin-top:${d.landTop}px;width:${d.landW + 2 * d.landBw}px;border-radius:${d.landRad}px;overflow:hidden;border:${d.landBw}px solid #16113A;flex:none;position:relative;z-index:2}
.land img{display:block;width:100%;height:auto}
.tag{position:relative;z-index:2;font-size:${px(12)};font-weight:600;letter-spacing:.04em;padding:${px(5)} ${px(10)};border-radius:999px;background:#16113A;color:#FFFFFF}
.zoom{position:absolute;z-index:4;background:#FFFFFF;border-radius:${px(20)};border:${px(3)} solid #0FD354;padding:${px(14)} ${px(16)};box-shadow:0 ${px(20)} ${px(44)} rgba(22,17,58,.24)}
.zoom.dark{background:#16113A}
.zoom.compact{padding:${px(14)} ${px(14)}}.compact .zt{font-size:${px(16)}}.compact .row{font-size:${px(13.5)}}
.dot{position:absolute;z-index:5;width:${px(18)};height:${px(18)};border-radius:50%;background:#0FD354;border:${px(3)} solid #FFFFFF;box-shadow:0 0 0 ${px(5)} rgba(15,211,84,.22)}
.zt{font-family:Poppins,sans-serif;font-weight:700;font-size:${px(17)};line-height:1.3;color:#16113A;margin:0}
.zs{font-size:${px(12.5)};line-height:1.4;color:#5B5677;margin:${px(2)} 0 0 0}
.row{display:flex;align-items:center;gap:${px(10)};padding:${px(7)} 0;border-bottom:${px(1)} solid #EEF0FB;font-size:${px(14)};line-height:1.35;color:#3D3858}
.row.on{color:#16113A;font-weight:600;background:#E7F8EE;margin:0 ${px(-8)};padding:${px(7)} ${px(8)};border-radius:${px(10)};border-bottom:none}
.ck{width:${px(18)};height:${px(18)};border-radius:${px(6)};border:${px(2)} solid #B9B5D6;flex:none}
.ck.y{background:#0FD354;border-color:#0FD354}
.btns{display:flex;gap:${px(8)};margin-top:${px(10)}}
.btn{font-size:${px(13)};line-height:1.3;font-weight:600;padding:${px(8)} ${px(12)};border-radius:999px;border:${px(2)} solid #16113A;color:#16113A;background:#FFFFFF;white-space:nowrap}
.btn.p{background:#16113A;color:#FFFFFF}
.d7{display:flex;gap:${px(5)};margin-top:${px(8)}}
.d7 span{width:${px(22)};height:${px(22)};border-radius:${px(7)};background:#0FD354}
.d7 span.x{background:#E3E0F0}`;

  const blobs = BLOBS.map(([s, l, t, c]) => `<span class="blob" style="width:${s * sr}px;height:${s * sr}px;left:${l * sx}px;top:${t * sy}px;background:${c}"></span>`).join('');
  const line = `<svg class="line" width="${PW}" height="${d.FH}" viewBox="0 0 ${PW} ${d.FH}"><path d="${scaled}" fill="none" stroke="#16113A" stroke-width="${3 * z}" stroke-dasharray="${12 * z} ${14 * z}" opacity="0.3"/></svg>`;
  const frames = FRAMES.map((f, i) => {
    const [left, at, w] = d.zoom[i];
    let mid;
    if (f.game) {
      mid = `<div class="land"><img src="${url(path.join(IMG, 'oyun-maceralar.webp'))}" alt="Moyo Oyun macera listesi"></div>
<span class="tag">Moyo Oyun ekranı</span>
<div class="land" style="margin-top:${8 * z}px"><img src="${url(path.join(IMG, 'oyun-onay-bekliyor.webp'))}" alt="Moyo Oyun onay bekleyen adım"></div>`;
    } else {
      const file = path.join(REAL, dev, `${f.shot}.png`);
      const [bg, dark] = topColor(file);
      TOP[f.shot] = [bg, dark === '1' ? '#FFFFFF' : '#0F1B3D'];
      mid = `<div class="scr">${d.sb(k, f.shot)}<img src="${url(file)}" alt="${f.alt}"></div>`;
    }
    const card = `<div class="zoom${f.dark ? ' dark' : ''}${f.cls ? ' ' + f.cls : ''}" data-left="${left}" data-at="${at}" data-game="${f.game ? 1 : ''}" style="left:${left}px;width:${w}px">${f.card}</div>`;
    const dot = f.game ? '' : `<span class="dot" data-dot="${f.dot || ''}"></span>`;
    return `<div class="fr${f.night ? ' night' : ''}"><p class="h">${f.h}</p><p class="s">${f.s}</p>${mid}${dot}${card}</div>`;
  }).join('\n');

  // Kartlar ekranın içindeki uygulama noktasına göre yerleşir (başlık satır sayısı karede farklı olabilir)
  const script = `document.fonts.ready.then(() => {
  const K = ${k}, SB = ${sbH}, BW = ${d.bw}, Z = ${z};
  document.querySelectorAll('.fr').forEach((fr) => {
    const card = fr.querySelector('.zoom');
    let top;
    if (card.dataset.game) { const l = fr.querySelectorAll('.land')[1]; top = l.offsetTop + l.offsetHeight + +card.dataset.at; }
    else { const s = fr.querySelector('.scr'); top = s.offsetTop + BW + SB + card.dataset.at * K; }
    card.style.top = top + 'px';
    const dot = fr.querySelector('.dot');
    if (dot) {
      const r = dot.dataset.dot ? card.querySelector(dot.dataset.dot) : null;
      const cy = r ? top + r.offsetTop + r.offsetHeight / 2 : top + card.offsetHeight / 2;
      dot.style.left = (card.offsetLeft - dot.offsetWidth / 2) + 'px';
      dot.style.top = (cy - dot.offsetHeight / 2) + 'px';
    }
  });
  document.body.dataset.ready = '1';
});`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Moyo A Döngü ${dev}</title><style>${css}</style></head>
<body><div class="pano">${blobs}${line}${frames}</div><script>${script}</script></body></html>`;
}

(async () => {
  const which = process.argv.slice(2).length ? process.argv.slice(2) : ['iphone', 'ipad'];
  const b = await chromium.launch();
  for (const dev of which) {
    const d = DEV[dev];
    const html = page(dev);
    const file = path.join(OUT, `panorama-${dev}.html`);
    fs.writeFileSync(file, html);
    const p = await b.newPage({ viewport: { width: d.FW * FRAMES.length, height: d.FH }, deviceScaleFactor: d.dpr });
    await p.goto(url(file));
    await p.waitForFunction(() => document.body.dataset.ready === '1');
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await p.waitForTimeout(500);
    // Denetim: Poppins (latin-ext dahil) yüklendi mi, kart metni taşmıyor mu
    const check = await p.evaluate(() => {
      const fonts = [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'Poppins').map((f) => `${f.weight}:${f.status}`);
      const tr = document.fonts.check('800 31px Poppins', 'ığşİçöü');
      const over = [...document.querySelectorAll('.zoom .zt, .zoom .zs, .zoom .row, .zoom .btns')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
      const lines = [...document.querySelectorAll('.zoom .zt')].filter((e) => e.getClientRects().length && e.offsetHeight > parseFloat(getComputedStyle(e).lineHeight) * 1.5).map((e) => e.textContent);
      const out = [...document.querySelectorAll('.zoom')].filter((c) => { const r = c.getBoundingClientRect(), fr = c.parentElement.getBoundingClientRect(); return r.right > fr.right - 2 || r.bottom > fr.bottom - 2 || r.left < fr.left; }).map((c) => c.textContent.trim().slice(0, 30));
      return { fonts, tr, over, lines, out };
    });
    console.log(dev, JSON.stringify(check));
    if (check.over.length || check.lines.length || check.out.length || !check.tr) { console.log('✗ kart düzeni'); process.exitCode = 1; }
    await p.screenshot({ path: path.join(OUT, `panorama-${dev}.png`), fullPage: false });
    await p.close();
    console.log('✓', dev);
  }
  await b.close();
})();
