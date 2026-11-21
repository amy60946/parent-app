// "A · Döngü" için gerçek Moyo (ParentApp) ekranları: web önizlemesi (preview/out/app.html), deneme verisi prep.js.
// iPhone 390x844 nokta @3x. iPad 768x1024 nokta @3x (küçük mantıksal ekran: uygulama içeriği karede büyük ve keskin durur).
// Tarayıcı saati 19 Kasım 2026 Perşembe 09:41 (Europe/Istanbul).
// Çıktı: store/out/dongu/real/<iphone|ipad>/<ad>.png + meta.json:
//   text  : ekranda görünen metin (denetim; kart metinleri de buradan doğrulanır)
//   items : görünen her öğenin kutusu, nokta cinsinden [x, y, w, h]. k: 't' metin, 'g' görsel/simge, 'b' zeminli kutu (satır, kart, çip, çubuk)
//           render.js kartları bu kutulara göre yerleştirir ve hiçbir öğeyi yarım kapatmadığını denetler.
// Her çekimde görünen metin denetlenir: beklenen sözcükler var mı, yasak sözcük (fiyat, deneme, "macera", eski ad, İngilizce hata) yok mu.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { prep } = require('./prep.js');
const OUT = path.join(__dirname, '../out/dongu/real');
const NOW = '2026-11-19T09:41:00+03:00';
const DEVICES = { iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, ipad: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 3 } };
// Uygulamanın sistem yazısı yerine Inter (iPhone'un SF Pro'suna en yakın; store/capture/capture.js ile aynı)
const FONT = `@font-face{font-family:BlinkMacSystemFont;src:local('Inter');font-weight:400}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter Medium');font-weight:500}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter SemiBold');font-weight:600}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter Bold');font-weight:700}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter ExtraBold');font-weight:800}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter Black');font-weight:900}`;
// Web önizlemesine özgü görüntü pürüzleri: kaydırınca açılan "Sil" düğmeleri kart kenarından sızıyor; öneri şeridinde para birimli öneri
const HIDE = ['[aria-label="Adımı sil"]', '[aria-label$=" ödülünü sil"]'];
const COLLAPSE = ['[aria-label^="Harçlık ekle"]', '[aria-label^="Ekran süresi ekle"]'];

// steps: '@etiket' erişim etiketi, '~metin' metin içerir, 'metin' tam metin (son eşleşme: sekme çubuğu en sonda)
// expect: ekranda görünmesi gereken metinler; render.js'teki kartların ve alt başlıkların dayandığı her metin burada
const SHOTS = [
  { name: 'rutinler', state: 'pending', steps: ['Rutinler', 'Sabah', 'Deniz'],
    expect: ['Rutinler', 'Sabah', 'Deniz', 'Sabah yatağını topla', 'Dişlerini fırçala', 'Ellerini yıka', 'Okul çantanı kaldır', 'Onay bekliyor', 'Tamamlandı'] },
  { name: 'onay', state: 'pending', steps: ['~1 adım onayını bekliyor', '@Dişlerini fırçala, Deniz: incele', '?Şimdi değil'], wait: 'Adımı incele', dim: true,
    expect: ['Adımı incele', 'Deniz', 'Bugünün adımı', 'Dişlerini fırçala', 'Yaptım dedi: 08:10', 'Güneş Taşı', 'Reddet', 'Tekrar dene', 'Onayla'] },
  { name: 'gelisim', state: 'all', steps: ['Gelişim'], scroll: 'end', // en alta: alışkanlıklar ve not sekme çubuğunun üstünde
    expect: ["Deniz'in gelişimi", 'Günlük tutarlılık', 'Haftalık tamamlama', 'Alışkanlıklar · son 4 hafta', 'Sabah yatağını topla', 'Dişlerini fırçala', 'Ellerini yıka', 'Okul çantanı kaldır', 'dikkat puanı değildir.'] },
  { name: 'davranis', state: 'pending', steps: ['Gelişim', '@Davranış kayıtları'], wait: 'Geçmiş kayıtlar',
    expect: ['Davranış kayıtları', 'Geçmiş kayıtlar', '18 Kasım 2026 · Akşam', 'Öncesinde : Ekran süresi bitti', 'Ne oldu : Diş fırçalamak istemedi', 'Sonrasında : Birlikte fırçaladık'] },
  { name: 'uzman', state: 'pending', steps: ['Uzmanım'], wait: 'Rutin ve adım önerileri',
    expect: ['Elif Örnek', 'Rutin ve adım önerileri', 'Yatmadan önce kitap oku', 'Yatmadan önce 10 dakika birlikte kitap okuyun.', 'Şimdilik değil', 'Rutinlere ekle', 'Paylaşılan çocuklar', 'Paylaşılıyor'] },
  { name: 'oduller', state: 'approved', steps: ['Ödül'], wait: 'Hafta sonu parka gitmek',
    expect: ['Ödüller', 'Hafta sonu parka gitmek', '10 Güneş Taşı', 'Deniz'] },
];
const FORBID = /ücretsiz|14 gün|deneme|\bTL\b|₺|indirim|macera|Nazlı|Fidan|Pofi|Android|Google|https?:|www\.|\.com\b|hata|yüklenemedi/i;
const FORBID_CS = /undefined|NaN|\bnull\b|Error|\[object/;

// Ekranda gerçekten görünen metin (başka sekmelerin bağlı kalan ekranları ve örtülen öğeler hariç)
const visibleText = () => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.trim();
    if (!t) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const b = r.getBoundingClientRect();
    if (!b.width || !b.height || b.bottom <= 0 || b.top >= innerHeight || b.right <= 0 || b.left >= innerWidth) continue;
    const x = Math.min(Math.max(b.left + b.width / 2, 1), innerWidth - 1), y = Math.min(Math.max(b.top + b.height / 2, 1), innerHeight - 1);
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(hit === n.parentElement || n.parentElement.contains(hit) || hit.contains(n.parentElement))) continue;
    const cs = getComputedStyle(n.parentElement);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    out.push(t);
  }
  return out.join('\n');
};

// Görünen öğelerin kutuları (nokta). Yarı saydam karartmanın altındaki öğeler de sayılır (dim: 1); opak bir katmanın altındakiler sayılmaz.
const visibleItems = () => {
  const W = innerWidth, H = innerHeight, out = [];
  const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number); return p.length > 3 ? p[3] : 1; };
  const related = (a, b) => a === b || a.contains(b) || b.contains(a);
  const state = (el, x, y) => { // 0 görünmüyor, 1 görünüyor, 2 karartmanın altında görünüyor
    let dim = 0;
    for (const h of document.elementsFromPoint(Math.min(Math.max(x, 1), W - 1), Math.min(Math.max(y, 1), H - 1))) {
      if (related(h, el)) return dim ? 2 : 1;
      const cs = getComputedStyle(h), a = alpha(cs.backgroundColor) * +cs.opacity;
      if (a > 0.9 || h.tagName === 'IMG' || h.tagName === 'CANVAS') return 0;
      if (a > 0.05) dim = 1;
    }
    return dim ? 2 : 1;
  };
  const shown = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; } return true; };
  const push = (k, b, el, extra) => {
    if (b.width < 2 || b.height < 2 || b.bottom <= 0 || b.top >= H || b.right <= 0 || b.left >= W) return;
    if (!shown(el)) return;
    const s = state(el, b.left + b.width / 2, b.top + b.height / 2);
    if (!s) return;
    out.push({ k, r: [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10), ...(s === 2 ? { dim: 1 } : {}), ...extra });
  };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.trim();
    if (!t) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    // Simge yazı tipindeki tek işaretler görseldir
    const icon = /^[-\u{F0000}-\u{10FFFF}]+$/u.test(t);
    push(icon ? 'g' : 't', r.getBoundingClientRect(), n.parentElement, icon ? {} : { t });
  }
  document.querySelectorAll('body *').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.width >= W - 1 && b.height >= H * 0.5) return; // ekran zemini
    const tag = el.tagName;
    if (tag === 'IMG' || tag === 'CANVAS' || tag === 'INPUT' || tag === 'TEXTAREA' || (tag === 'svg' && !el.closest('svg svg'))) { push('g', b, el, {}); return; }
    if (el.closest('svg')) return;
    const cs = getComputedStyle(el);
    const bg = alpha(cs.backgroundColor) > 0.05 || cs.backgroundImage !== 'none';
    const bd = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && alpha(cs[`border${s}Color`]) > 0.05 && cs[`border${s}Style`] !== 'none');
    if (bg || bd) push('b', b, el, { c: cs.backgroundColor.replace(/\s+/g, ''), ...(el.getAttribute('aria-label') ? { l: el.getAttribute('aria-label') } : {}) });
  });
  return out;
};

(async () => {
  const only = process.argv.slice(2);
  const b = await chromium.launch();
  let bad = 0;
  for (const [dev, opts] of Object.entries(DEVICES)) {
    if (only.length && !only.includes(dev)) continue;
    const dir = path.join(OUT, dev);
    fs.mkdirSync(dir, { recursive: true });
    const meta = {};
    for (const s of SHOTS) {
      const ctx = await b.newContext({ ...opts, timezoneId: 'Europe/Istanbul', locale: 'tr-TR' });
      const p = await ctx.newPage();
      await p.clock.install({ time: new Date(NOW) });
      p.on('pageerror', (e) => console.log('ERR', dev, s.name, e.message));
      await p.addInitScript((css) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }); }, FONT);
      await prep(p, { clinic: true, state: s.state, wide: opts.viewport.width >= 700 });
      for (const st of s.steps) {
        const optional = st.startsWith('?');
        const q = optional ? st.slice(1) : st;
        try {
          if (q.startsWith('@')) await p.getByLabel(q.slice(1)).first().click({ timeout: optional ? 1500 : 4000 });
          else if (q.startsWith('~')) await p.getByText(q.slice(1)).first().click({ timeout: optional ? 1500 : 4000 });
          else await p.getByText(q, { exact: true }).last().click({ timeout: optional ? 1500 : 4000 });
        } catch { if (!optional) { console.log('ADIM YOK', dev, s.name, q); bad++; } }
        await p.waitForTimeout(1200);
      }
      if (s.scroll) { const v = opts.viewport; await p.mouse.move(v.width / 2, v.height / 2); await p.mouse.wheel(0, s.scroll === 'end' ? 5000 : s.scroll); await p.waitForTimeout(900); }
      if (s.wait) { try { await p.getByText(s.wait, { exact: true }).last().waitFor({ timeout: 5000 }); } catch { console.log('GÖRÜNMEDİ', dev, s.name, s.wait); bad++; } }
      await p.evaluate(({ hide, collapse }) => {
        hide.forEach((q) => document.querySelectorAll(q).forEach((e) => { e.style.visibility = 'hidden'; }));
        collapse.forEach((q) => document.querySelectorAll(q).forEach((e) => { e.style.display = 'none'; }));
      }, { hide: HIDE, collapse: COLLAPSE });
      // Alttan açılan sayfa (Sheet) en çok 640 nokta: geniş ekranda karartma yalnız sayfanın üstünde kalıyor, iki yanında bitiyor.
      // Mağaza görselinde karartma bütün ekranı kaplar (yalnız iPad çekimi; uygulamadaki karşılığı Sheet.tsx'te düzeltilmeli).
      if (s.dim && opts.viewport.width > 640) {
        const n = await p.evaluate(() => {
          let k = 0;
          document.querySelectorAll('[aria-label="Kapat"]').forEach((e) => {
            const c = getComputedStyle(e).backgroundColor;
            if (!/rgba\(15, 27, 61, 0\.35\)/.test(c) || !e.parentElement) return;
            e.parentElement.style.backgroundColor = c; e.style.backgroundColor = 'transparent'; k++;
          });
          return k;
        });
        if (n !== 1) { console.log('KARARTMA', dev, s.name, n); bad++; }
      }
      await p.mouse.move(1, 1);
      await p.waitForTimeout(900);
      await p.screenshot({ path: path.join(dir, `${s.name}.png`) });
      const text = await p.evaluate(visibleText);
      const flat = text.replace(/\s+/g, ' ');
      const miss = s.expect.filter((x) => !flat.includes(x));
      const forb = text.split('\n').filter((l) => FORBID.test(l) || FORBID_CS.test(l));
      if (miss.length) { console.log('EKSİK', dev, s.name, miss); bad++; }
      if (forb.length) { console.log('YASAK', dev, s.name, forb); bad++; }
      const items = await p.evaluate(visibleItems);
      meta[s.name] = { text, items };
      console.log('ok', dev, s.name, items.length);
      await ctx.close();
    }
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
  }
  await b.close();
  if (bad) { console.log(`✗ ${bad} denetim hatası`); process.exit(1); }
})();
