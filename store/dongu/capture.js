// "A · Döngü" için gerçek Moyo (ParentApp) ekranları: web önizlemesi (preview/out/app.html), deneme verisi prep.js.
// iPhone 390x844 nokta @3x, iPad 1024x1366 nokta @2x. Tarayıcı saati 19 Kasım 2026 Perşembe 09:41 (Europe/Istanbul).
// Çıktı: store/out/dongu/real/<iphone|ipad>/<ad>.png + meta.json (görünen metin, öğe kutuları).
// Her çekimde görünen metin denetlenir: beklenen sözcükler var mı, yasak sözcük (fiyat, deneme, "macera", eski ad, İngilizce hata) yok mu.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { prep } = require('./prep.js');
const OUT = path.join(__dirname, '../out/dongu/real');
const NOW = '2026-11-19T09:41:00+03:00';
const DEVICES = { iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, ipad: { viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2 } };
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
const SHOTS = [
  { name: 'rutinler', state: 'pending', steps: ['Rutinler', 'Sabah', 'Deniz'],
    expect: ['Rutinler', 'Sabah yatağını topla', 'Dişlerini fırçala', 'Ellerini yıka', 'Okul çantanı kaldır', 'Onay bekliyor', 'Tamamlandı'],
    boxes: { dis: 'Dişlerini fırçala', yatak: 'Sabah yatağını topla', canta: 'Okul çantanı kaldır' } },
  { name: 'onay', state: 'pending', steps: ['~1 adım onayını bekliyor', '@Dişlerini fırçala, Deniz: incele', '?Şimdi değil'], wait: 'Adımı incele',
    expect: ['Adımı incele', 'Deniz', 'Dişlerini fırçala', 'Yaptım dedi: 08:10', 'Tekrar dene', 'Onayla'],
    boxes: { kart: 'Bugünün adımı', onayla: '@Onayla', baslik: 'Adımı incele' } },
  { name: 'gelisim', state: 'all', steps: ['Gelişim'], scroll: 76, // en alta: alışkanlıklar ve not sekme çubuğunun üstünde
    expect: ["Deniz'in gelişimi", 'Günlük tutarlılık', 'Haftalık tamamlama', 'Dişlerini fırçala'],
    boxes: { gunluk: 'Günlük tutarlılık', haftalik: 'Haftalık tamamlama', aliskanlik: '~Alışkanlıklar' } },
  { name: 'davranis', state: 'pending', steps: ['Gelişim', '@Davranış kayıtları'], wait: 'Geçmiş kayıtlar',
    expect: ['Davranış kayıtları', 'Ekran süresi bitti', 'Birlikte fırçaladık', 'Akşam'],
    boxes: { ilk: 'Ekran süresi bitti', ikinci: 'Kahvaltı uzadı' } },
  { name: 'uzman', state: 'pending', steps: ['Uzmanım'], wait: 'Rutin ve adım önerileri',
    expect: ['Elif Örnek', 'Yatmadan önce kitap oku', 'Şimdilik değil', 'Rutinlere ekle', 'Paylaşılıyor'],
    boxes: { randevu: 'Randevular', oneri: 'Yatmadan önce kitap oku', paylasim: 'Paylaşılan çocuklar' } },
  { name: 'oduller', state: 'approved', steps: ['Ödül'], wait: 'Hafta sonu parka gitmek',
    expect: ['Ödüller', 'Hafta sonu parka gitmek', 'Deniz'],
    boxes: { park: 'Hafta sonu parka gitmek', film: 'Film gecesi', bakiye: '~Deniz' } },
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
      await prep(p, { clinic: true, state: s.state });
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
      if (s.scroll) { const v = opts.viewport; await p.mouse.move(v.width / 2, v.height / 2); await p.mouse.wheel(0, s.scroll); await p.waitForTimeout(900); }
      if (s.wait) { try { await p.getByText(s.wait, { exact: true }).last().waitFor({ timeout: 5000 }); } catch { console.log('GÖRÜNMEDİ', dev, s.name, s.wait); bad++; } }
      await p.evaluate(({ hide, collapse }) => {
        hide.forEach((q) => document.querySelectorAll(q).forEach((e) => { e.style.visibility = 'hidden'; }));
        collapse.forEach((q) => document.querySelectorAll(q).forEach((e) => { e.style.display = 'none'; }));
      }, { hide: HIDE, collapse: COLLAPSE });
      await p.mouse.move(1, 1);
      await p.waitForTimeout(900);
      await p.screenshot({ path: path.join(dir, `${s.name}.png`) });
      const text = await p.evaluate(visibleText);
      const flat = text.replace(/\s+/g, ' ');
      const miss = s.expect.filter((x) => !flat.includes(x));
      const forb = text.split('\n').filter((l) => FORBID.test(l) || FORBID_CS.test(l));
      if (miss.length) { console.log('EKSİK', dev, s.name, miss); bad++; }
      if (forb.length) { console.log('YASAK', dev, s.name, forb); bad++; }
      const boxes = {};
      for (const [k, q] of Object.entries(s.boxes || {})) {
        const loc = q.startsWith('@') ? p.getByLabel(q.slice(1), { exact: true }).last()
          : q.startsWith('~') ? p.getByText(q.slice(1)).last() : p.getByText(q, { exact: true }).last();
        try { boxes[k] = await loc.boundingBox({ timeout: 1500 }); } catch { boxes[k] = null; }
      }
      meta[s.name] = { text, boxes };
      console.log('ok', dev, s.name);
      await ctx.close();
    }
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  }
  await b.close();
  if (bad) { console.log(`✗ ${bad} denetim hatası`); process.exit(1); }
})();
