// ParentApp gerçek ekranları: 440x868 nokta @3x (iPhone 6.9" ekranının durum çubuğu ve ana çizgi hariç kısmı)
const { chromium } = require('playwright');
const fs = require('fs');
const { prep } = require('./prep.js');
const OUT = process.env.STORE_REAL || (__dirname + '/../out/real');
fs.mkdirSync(OUT, { recursive: true });
const FONT = `@font-face{font-family:BlinkMacSystemFont;src:local('Inter');font-weight:400}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter Medium');font-weight:500}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter SemiBold');font-weight:600}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter Bold');font-weight:700}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter ExtraBold');font-weight:800}
@font-face{font-family:BlinkMacSystemFont;src:local('Inter Black');font-weight:900}`;
const shots = JSON.parse(fs.readFileSync(process.argv[2] || (__dirname + '/shots.json'), 'utf8'));
(async () => {
  const b = await chromium.launch();
  const meta = {};
  for (const s of shots) {
    const p = await (await b.newContext({ viewport: { width: 440, height: 868 }, deviceScaleFactor: 3 })).newPage();
    p.on('pageerror', e => console.log('ERR', s.name, e.message));
    await p.addInitScript((css) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }); }, FONT);
    await prep(p, { clinic: !!s.clinic });
    for (const st of s.steps || []) {
      try {
        if (st.startsWith('@')) await p.getByLabel(st.slice(1)).first().click({ timeout: 4000 });
        else if (st.startsWith('~')) await p.getByText(st.slice(1)).first().click({ timeout: 4000 });
        else if (st.startsWith('scroll:')) await p.mouse.wheel(0, +st.slice(7));
        else if (st.startsWith('xy:')) { const [x, y] = st.slice(3).split(',').map(Number); await p.mouse.click(x, y); }
        else await p.getByText(st, { exact: true }).first().click({ timeout: 4000 });
      } catch (e) { console.log('MISS', s.name, st); }
      await p.waitForTimeout(1100);
    }
    for (const lb of s.dismiss || []) { await p.waitForTimeout(1200); try { await p.getByText(lb, { exact: true }).first().click({ timeout: 1500 }); } catch { try { await p.getByLabel(lb, { exact: true }).first().click({ timeout: 1500 }); } catch { console.log('no', lb, s.name); } } }
    if (s.scroll) { await p.mouse.move(220, 500); await p.mouse.wheel(0, s.scroll); await p.waitForTimeout(800); }
    for (const sel of s.hide || []) await p.evaluate((q) => document.querySelectorAll(q).forEach(e => e.style.display = 'none'), sel);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/${s.name}.png` });
    const font = await p.evaluate(() => getComputedStyle(document.querySelector('[dir]') || document.body).fontFamily);
    meta[s.name] = { font: font.slice(0, 60), text: (await p.evaluate(() => document.body.innerText)).replace(/\n{2,}/g, '\n').slice(0, +s.textLen || 220) };
    meta[s.name].boxes = {};
    for (const [k, q] of Object.entries(s.boxes || {})) {
      const loc = q.startsWith('@') ? p.getByLabel(q.slice(1)).first() : p.getByText(q.replace(/^~/, ''), { exact: !q.startsWith('~') }).first();
      try { meta[s.name].boxes[k] = await loc.boundingBox(); } catch { meta[s.name].boxes[k] = null; }
    }
    console.log('ok', s.name);
    await p.context().close();
  }
  fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
  await b.close();
})();
