// App Store ekran görüntüleri: üç tasarım (A sakin/kurumsal, B lacivert + büyütülmüş ayrıntı, C bağlı hikâye).
// Girdi: out/real/*.png (capture/capture.js, 440x868 nokta @3x), site/public/img (oyun görselleri, simgeler), out/fonts.
// Çıktı: out/<A|B|C>/NN.png (1320x2868 iPhone 6.9"). slice.py saydamlığı kaldırır, 6.3" (1206x2622) ve önizleme üretir.
// Kullanım: node store/render.js [A B C]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const REAL = path.join(OUT, 'real');
const IMG = path.join(ROOT, 'site/public/img');
const FONTS = path.join(OUT, 'fonts');
const W = 1320, H = 2868, PT = 440, SCREEN_PT = 868; // tuval, ekran genişliği ve yüksekliği (nokta)
const url = (p) => 'file://' + p;
const real = (n) => url(path.join(REAL, n + '.png'));
const img = (n) => url(path.join(IMG, n));

// Ekranların üst rengi (durum çubuğu bu renkte; koyu üstte yazı beyaz). reviewDetail: alt sayfa açıkken karartılmış üst.
const TOP = { care: ['#0F1B3D', '#fff'], reviewDetail: ['#A4A9B6', '#0F1B3D'] };

/* ---------- Metinler (siz dili; web sitesiyle aynı; hukuk/45 ve Apple 2.3.7/2.3.8'e göre) ----------
   crop: büyütülecek kart [x, y, w, h] nokta (gerçek ekranda ölçüldü, kart sınırı + birkaç nokta pay)
   from: ekranın üstten kaç noktası atlanır (alt sayfa / kaydırılmış görünüm) */
const SLIDES = [
  { shot: 'home', h: 'Çocuğunuzun günlük rutini <em>tek ekranda</em>', s: 'Görev verin, yapılanları görün, onaylayın.',
    crop: [14, 84, 412, 76], eyebrow: 'ParentApp' },
  { shot: 'create', h: 'Rutini <em>birkaç dakikada</em> oluşturun', s: 'Yaşına uygun hazır rutinlerden seçin ya da kendi görevinizi yazın.',
    crop: [12, 150, 316, 128], eyebrow: '1 · Plan' },
  { shot: 'tasks', h: 'Görevler <em>Pofi Adası’nda</em> görünür', s: 'Çocuğunuz görevini oyunda görür, yapınca işaretler.',
    note: 'Pofi Adası, çocuğunuzun cihazına kurulan ayrı bir uygulamadır.', crop: [14, 241, 412, 113], game: 'iskele.jpg', eyebrow: '2 · Oyun' },
  { shot: 'reviewDetail', from: 200, h: 'Yapılan görevi <em>onaylayın</em>', s: 'Onayladığınızda çocuğunuz oyunda Güneş Taşı alır.',
    crop: [12, 772, 416, 68], eyebrow: '3 · Onay' },
  { shot: 'rewards', h: 'Ödülleri <em>birlikte</em> seçin', s: 'Çocuğunuz biriktirdiği Güneş Taşı’yla ödül ister, siz onaylarsınız.',
    crop: [12, 112, 416, 70], eyebrow: '4 · Ödül' },
  { shot: 'progress', h: 'Gelişimi <em>gün gün</em> görün', s: 'Hangi alışkanlığın yerleştiğini haftalık özetle görün.',
    crop: [14, 341, 412, 184], cFrom: 120, eyebrow: '5 · Gelişim' },
  { shot: 'care', h: 'Dilerseniz <em>uzmanınızla</em> paylaşın', s: 'Paylaşım yalnız sizin onayınızla açılır, istediğiniz an kapanır.',
    crop: [14, 482, 412, 203], trust: true, eyebrow: 'İsteğe bağlı · Uzman' },
];
const TRUST = ['Reklam yok', 'Veri satışı yok', 'Hesabınızı istediğiniz an silebilirsiniz'];
const FOOT = 'Bazı özellikler Premium üyelik gerektirir. Örnekteki adlar kurgusaldır.';
const POFI = 'Çocuğunuzun cihazındaki Pofi Adası oyunuyla birlikte çalışır.';

/* ---------- Parçalar ---------- */
const statusBar = (k, shot) => {
  const [bg, fg] = TOP[shot] || ['#F5F6F8', '#0F1B3D'];
  return `<div class="sb" style="height:${54 * k}px;background:${bg};color:${fg};padding:0 ${30 * k}px 0 ${44 * k}px">
    <span style="font-size:${17 * k}px">9:41</span>
    <svg viewBox="0 0 76 13" style="width:${76 * k}px;height:${13 * k}px" fill="${fg}">
      <rect x="0" y="8" width="3" height="4" rx=".8"/><rect x="4.6" y="5.6" width="3" height="6.4" rx=".8"/><rect x="9.2" y="3" width="3" height="9" rx=".8"/><rect x="13.8" y=".4" width="3" height="11.6" rx=".8"/>
      <path d="M30.5 3.1a10.6 10.6 0 0 1 14.6 0l1.2-1.2a12.3 12.3 0 0 0-17 0zM33 5.6a7 7 0 0 1 9.6 0l1.2-1.2a8.7 8.7 0 0 0-12 0zM35.4 8.1a3.5 3.5 0 0 1 4.8 0l-2.4 2.5z"/>
      <rect x="50.5" y=".9" width="22" height="11.2" rx="3.2" fill="none" stroke="${fg}" stroke-opacity=".4" stroke-width="1"/><rect x="52.3" y="2.7" width="18.4" height="7.6" rx="1.8"/><path d="M74 4.6v3.8a2 2 0 0 0 0-3.8z" fill-opacity=".45"/>
    </svg></div>`;
};
// Gerçek ekran (cihaz çerçevesi yok): genişlik px; görünen alan, durum çubuğunun altında en çok `maxPx` piksele kadar
const screen = (shot, w, { maxPx, from = 0, fade = false, style = '' }) => {
  const k = w / PT;
  const viewPt = Math.min(maxPx / k - 54, SCREEN_PT - from);
  return `<div class="scr${fade ? ' fade' : ''}" style="width:${w}px;border-radius:${50 * k}px;${style}">${statusBar(k, shot)}
    <div style="height:${viewPt * k}px;background:url('${real(shot)}') 0 ${-from * k}px/${w}px auto no-repeat"></div></div>`;
};
// Ekrandan büyütülmüş kart: [x, y, w, h] nokta, k px/nokta
const crop = (shot, [x, y, w, h], k, style = '') =>
  `<div class="crop" style="width:${w * k}px;height:${h * k}px;border-radius:${18 * k}px;background:url('${real(shot)}') ${-x * k}px ${-y * k}px/${PT * k}px auto no-repeat;${style}"></div>`;
const game = (file, w, style = '') => `<div class="game" style="width:${w}px;height:${Math.round(w * 768 / 1376)}px;border-radius:${w * 0.05}px;background:url('${img(file)}') center/cover;${style}"></div>`;
const brand = (size, color) => `<div class="brand" style="font-size:${size * 0.52}px;color:${color}"><img src="${img('parentapp-simge.png')}" style="width:${size}px;height:${size}px;border-radius:${size * 0.225}px">ParentApp</div>`;
const pofi = () => `<p class="note pofi"><img src="${img('pofi-simge.png')}">${POFI}</p>`;
const chips = (c) => `<div class="chips">${TRUST.map((x) => `<span class="chip">${check(c)}${x}</span>`).join('')}</div>`;
const check = (c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>`;
const text = (sl, i, brandColor, chipColor, extra = '') => `<div class="t" style="top:${i === 0 ? 130 : 150}px">
  ${i === 0 ? brand(104, brandColor) : extra}<h1>${sl.h}</h1><p class="s">${sl.s}</p>
  ${i === 0 ? pofi() : ''}${sl.note ? `<p class="note">${sl.note}</p>` : ''}${sl.trust ? chips(chipColor) : ''}</div>`;

/* ---------- Tasarımlar ---------- */
const BASE = `
@font-face{font-family:Serif4;src:url('${url(path.join(FONTS, 'source-serif-4-latin-600-normal.woff2'))}') format('woff2');font-weight:600;unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:Serif4;src:url('${url(path.join(FONTS, 'source-serif-4-latin-ext-600-normal.woff2'))}') format('woff2');font-weight:600;unicode-range:U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W * SLIDES.length}px;height:${H}px;position:relative;overflow:hidden;font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}
.p{position:absolute;top:0;width:${W}px;height:${H}px;overflow:hidden}
.t{position:absolute;left:110px;right:110px;z-index:3}
h1{font-family:'Inter Display',Inter,sans-serif;font-weight:800;font-size:104px;line-height:1.07;letter-spacing:-1.6px;text-wrap:balance}
h1 em{font-style:normal}
.s{font-weight:500;font-size:46px;line-height:1.36;margin-top:34px;text-wrap:pretty}
.scr{position:absolute;overflow:hidden;background:#F5F6F8;z-index:1}
.scr.fade::after{content:"";position:absolute;left:0;right:0;bottom:0;height:200px;background:linear-gradient(rgba(245,246,248,0),#F5F6F8 85%)}
.sb{display:flex;align-items:center;justify-content:space-between;font-weight:600;letter-spacing:-.2px}
.crop,.game{position:absolute;z-index:2}
.brand{display:flex;align-items:center;gap:.5em;font-family:'Inter Display',Inter,sans-serif;font-weight:800;letter-spacing:-.5px;margin-bottom:56px}
.chips{display:flex;flex-wrap:wrap;gap:18px;margin-top:40px}
.chip{display:flex;align-items:center;gap:14px;font-weight:600;font-size:34px;padding:16px 28px;border-radius:999px}
.chip svg{width:34px;height:34px}
.note{font-size:32px;font-weight:500;line-height:1.4;margin-top:24px}
.pofi{display:flex;align-items:center;gap:20px;margin-top:34px}
.pofi img{width:68px;height:68px;border-radius:16px;flex:none}
.foot{position:absolute;left:110px;right:110px;bottom:70px;font-size:28px;font-weight:500;text-align:center;z-index:3}
.bottom{position:absolute;left:0;right:0;bottom:0;height:300px;z-index:2;pointer-events:none}
`;
// Son kare: ekran tam görünür, dipnot altta düz zeminde
const LAST_END = 2640;

// A · Sakin ve kurumsal: açık zemin, lacivert başlık, tam ekran (Structured, Acorns Early, GoHenry, Khan Academy Kids)
function A() {
  const bg = '#F6F8FB';
  const css = `${BASE}
  .p{background:linear-gradient(180deg,#E7ECF6 0%,${bg} 45%)}
  h1,h1 em{color:#0F1B3D}
  .s{color:#5A6380}
  .scr{box-shadow:0 0 0 2px rgba(15,27,61,.07),0 50px 110px rgba(15,27,61,.16)}
  .game{border:12px solid #fff;box-shadow:0 40px 90px rgba(15,27,61,.22)}
  .chip{background:#fff;color:#0F1B3D;box-shadow:0 0 0 2px rgba(15,27,61,.08)}
  .note,.foot{color:#6E7690}
  .bottom{background:linear-gradient(rgba(246,248,251,0),${bg} 80%)}`;
  const body = SLIDES.map((sl, i) => {
    const w = 1060, top = sl.trust ? 1130 : i === 0 ? 1010 : 830;
    const left = (W - w) / 2;
    let mid = screen(sl.shot, w, { maxPx: (sl.trust ? LAST_END : H) - top, from: sl.from, fade: !!sl.trust, style: `left:${left}px;top:${top}px` });
    if (i === 0) mid += game('adalilar.jpg', 760, `left:${W - 760 - 70}px;top:2330px`); // ana sayfanın boş alt kısmında oyun
    if (sl.game) mid += game(sl.game, 900, `left:${W - 900 - 60}px;top:2170px`); // görev listesinin altında
    return `<section class="p" style="left:${i * W}px">${text(sl, i, '#0F1B3D', '#2F7D4A')}${mid}
      ${sl.trust ? `<p class="foot">${FOOT}</p>` : '<div class="bottom"></div>'}</section>`;
  }).join('');
  return { css, body };
}

// B · Lacivert marka, büyütülmüş ayrıntı (Chorsee, Understood, Life360, Tiimo; Güneş Taşı sarısı vurgu)
function B() {
  const css = `${BASE}
  .p{background:radial-gradient(1400px 1100px at 90% 8%,#22346A 0%,rgba(34,52,106,0) 70%),#0F1B3D}
  h1{color:#fff} h1 em{color:#F2BE3D}
  .s{color:#C3CAE0}
  .scr{box-shadow:0 60px 120px rgba(0,0,0,.45)}
  .crop{box-shadow:0 40px 90px rgba(0,0,0,.42),0 0 0 3px rgba(255,255,255,.9)}
  .game{border:12px solid #fff;box-shadow:0 50px 110px rgba(0,0,0,.45)}
  .chip{background:rgba(255,255,255,.1);color:#fff;box-shadow:inset 0 0 0 2px rgba(255,255,255,.18)}
  .note,.foot{color:#AEB7D3}
  .scr.fade::after{display:none}
  .bottom{background:linear-gradient(rgba(15,27,61,0),#0F1B3D 85%)}`;
  const body = SLIDES.map((sl, i) => {
    const w = 940, k = w / PT, top = sl.trust ? 1210 : i === 0 ? 1100 : 900, ck = 2.95;
    const [cx, cy, cw, ch] = sl.crop, from = sl.from || 0;
    let mid = screen(sl.shot, w, { maxPx: (sl.trust ? LAST_END : H) - top, from, style: `left:${(W - w) / 2}px;top:${top}px` });
    if (sl.game) mid += game(sl.game, 1160, `left:${(W - 1160) / 2}px;top:1830px`); // büyütülen "ayrıntı" oyunun kendisi
    else {
      const ctop = top + (54 + cy - from) * k - (ck - k) * ch / 2; // büyütülen kart kendi yerinin üstüne ortalanır
      mid += crop(sl.shot, sl.crop, ck, `left:${(W - cw * ck) / 2}px;top:${Math.round(ctop)}px`);
    }
    return `<section class="p" style="left:${i * W}px">${text(sl, i, '#fff', '#F2BE3D')}${mid}
      ${sl.trust ? `<p class="foot">${FOOT}</p>` : '<div class="bottom"></div>'}</section>`;
  }).join('');
  return { css, body };
}

// C · Bağlı hikâye: tek parça zemin, adım etiketleri, kareleri birleştiren yol (ClassDojo, Joon 3–4, Structured 1–2)
function C() {
  const n = SLIDES.length, TW = W * n, END = 2560;
  const css = `${BASE}
  body{background:linear-gradient(90deg,#E6F0FA 0%,#EEF3F8 35%,#FBF4E6 70%,#F6EFE2 100%)}
  h1{font-family:Serif4,Georgia,serif;font-weight:600;font-size:96px;line-height:1.1;letter-spacing:-.8px;color:#0F1B3D}
  h1 em{color:#0F1B3D;background:linear-gradient(transparent 68%,rgba(242,190,61,.55) 68%,rgba(242,190,61,.55) 92%,transparent 92%)}
  .s{color:#4E5876}
  .eb{display:inline-flex;align-items:center;gap:16px;font-weight:700;font-size:34px;letter-spacing:.06em;text-transform:uppercase;color:#1B2A55;margin-bottom:36px}
  .eb i{width:18px;height:18px;border-radius:50%;background:#E9B22B;display:block}
  .scr{box-shadow:0 0 0 2px rgba(15,27,61,.06),0 50px 110px rgba(15,27,61,.18)}
  .game{border:12px solid #fff;box-shadow:0 40px 90px rgba(15,27,61,.22)}
  .chip{background:#fff;color:#0F1B3D;box-shadow:0 0 0 2px rgba(15,27,61,.08)}
  .note,.foot{color:#6E7690}
  .p{overflow:visible}
  .layer{position:absolute;left:0;top:0;width:${TW}px;height:${H}px;pointer-events:none}`;
  // Yol: ekranların altından geçen kesik sarı çizgi, her karede bir durak
  const pts = SLIDES.map((_, i) => [i * W + W / 2, i % 2 ? 2720 : 2650]);
  let d = 'M -40 2690';
  pts.forEach(([x, y], i) => { const px = i ? pts[i - 1][0] : -40; d += ` C ${px + W / 2} ${y - 110}, ${x - W / 2} ${y + 110}, ${x} ${y}`; });
  const dots = pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="22" fill="#E9B22B"/><circle cx="${x}" cy="${y}" r="10" fill="#fff"/>`).join('');
  const layer = `<svg class="layer" viewBox="0 0 ${TW} ${H}"><path d="${d}" fill="none" stroke="#E9B22B" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 30"/>${dots}</svg>`;
  const body = SLIDES.map((sl, i) => {
    const w = sl.game ? 920 : 1000, top = sl.trust ? 1160 : i === 0 ? 1130 : 940 + (i % 2) * 40;
    const left = sl.game ? 80 : (W - w) / 2;
    let mid = screen(sl.shot, w, { maxPx: END - top, from: sl.from ?? sl.cFrom, fade: true, style: `left:${left}px;top:${top}px` });
    if (sl.game) mid += game(sl.game, 860, `left:${W - 860 - 50}px;top:1980px;transform:rotate(-3deg)`);
    if (i === 3) mid += `<img src="${img('gunes-tasi.png')}" style="position:absolute;z-index:2;left:${W - 300}px;top:2260px;width:200px;height:200px;filter:drop-shadow(0 20px 30px rgba(15,27,61,.25))">`;
    const eb = `<span class="eb"><i></i>${sl.eyebrow}</span>`;
    return `<section class="p" style="left:${i * W}px">${text(sl, i, '#0F1B3D', '#2F7D4A', eb)}${mid}
      ${sl.trust ? `<p class="foot" style="bottom:40px">${FOOT}</p>` : ''}</section>`;
  }).join('');
  return { css, body: layer + body };
}

(async () => {
  const which = process.argv.slice(2).length ? process.argv.slice(2) : ['A', 'B', 'C'];
  const b = await chromium.launch();
  for (const name of which) {
    const { css, body } = { A, B, C }[name]();
    const file = path.join(OUT, `${name}.html`);
    fs.writeFileSync(file, `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
    const p = await b.newPage({ viewport: { width: W * SLIDES.length, height: H }, deviceScaleFactor: 1 });
    await p.goto(url(file));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(800);
    fs.mkdirSync(path.join(OUT, name), { recursive: true });
    for (let i = 0; i < SLIDES.length; i++)
      await p.screenshot({ path: path.join(OUT, name, `${String(i + 1).padStart(2, '0')}.png`), clip: { x: i * W, y: 0, width: W, height: H } });
    await p.close();
    console.log('✓', name);
  }
  await b.close();
})();
