// Alternatif 3 · Dokun: sekmeli bölüm (tek telefon; dar ekranda etkin maddenin içine taşınır) + dokunarak denenen akış.
(() => {
  function tabs(root) {
    const items = [...root.querySelectorAll('.tab3')], stage = root.querySelector('.tabs3-stage'), phone = root.querySelector('.phone');
    const screens = () => [...phone.querySelectorAll('.screen')];
    const narrow = matchMedia('(max-width: 860px)');
    let cur = 0;
    const place = () => (narrow.matches ? items[cur].querySelector('.slot') : stage).appendChild(phone);
    const show = (k, manual) => {
      cur = (k + items.length) % items.length;
      items.forEach((it, i) => { it.classList.toggle('on', i === cur); it.querySelector('.tab3-head').setAttribute('aria-expanded', String(i === cur)); });
      screens().forEach((s, i) => s.classList.toggle('on', i === cur));
      if (manual) root.classList.add('manual');
      place();
    };
    items.forEach((it, i) => {
      it.querySelector('.tab3-head').addEventListener('click', () => show(i, true));
      it.querySelector('.tab3-bar b')?.addEventListener('animationend', () => show(cur + 1));
    });
    narrow.addEventListener('change', place);
    new IntersectionObserver(([e]) => root.classList.toggle('inview', e.isIntersecting), { threshold: 0.35 }).observe(root);
    show(0);
    return { show, phone, items };
  }

  document.querySelectorAll('[data-tabs="auto"]').forEach(tabs);

  // Dokunarak dene: 1 "3 macerayı ekle" → 2 oyunda "Yaptım" → 3 ebeveyn ✓ onaylar. Takılma olmasın diye başlıklar da adımı açar.
  document.querySelectorAll('[data-tabs="demo"]').forEach((root) => {
    const t = tabs(root), phone = t.phone, note = phone.querySelector('.demo-note'), again = root.querySelector('[data-reset]');
    const tries = [...root.querySelectorAll('.try')], first = tries.map((x) => x.textContent);
    const start = [...phone.querySelectorAll('.screen')].map((s) => s.innerHTML);
    let timer;
    const later = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
    const arm = () => phone.querySelectorAll('[data-act="add"], [data-act="done"], [data-act="ok"]').forEach((b) => b.classList.add('pulse'));
    const settle = (b, text) => { b.textContent = text; b.classList.remove('pulse'); b.classList.add('ok'); b.disabled = true; };
    const acts = {
      add(b) { settle(b, '✓ 3 macera eklendi'); tries[0].textContent = 'Eklendi. Sıra çocuğunuzda.'; later(() => t.show(1), 1100); },
      done(b) {
        settle(b, '✓ Yapıldı');
        const s = b.closest('.screen'); s.querySelector('.care').classList.remove('lock'); s.querySelector('[data-carehint]').textContent = 'Okti’nin bakımı açıldı.';
        note.classList.add('show'); tries[1].textContent = 'Telefonunuza bildirim geldi.';
        later(() => { note.classList.remove('show'); t.show(2); }, 2200);
      },
      ok(b) {
        const s = b.closest('.screen'), card = s.querySelector('[data-approve]');
        card.classList.add('ok');
        card.innerHTML = '<div class="row"><span class="ck on">✓</span><div class="grow"><b>Onaylandı</b><div class="muted">Dişlerini fırçala · Nazlı</div></div><span class="sunchip"><img src="img/gunes-tasi.png" alt="">+1 puan</span></div>';
        [90, 75, 60].forEach((v, i) => { const r = s.querySelectorAll('[data-skills] .row')[i]; r.querySelector('i').style.setProperty('--p', v + '%'); r.querySelector('.pct').textContent = '%' + v; });
        tries[2].textContent = 'Onaylandı. Çocuğunuz oyunda puanını aldı.';
        again.hidden = false;
      },
      no() { tries[2].textContent = 'Denemede ✓ ile onaylayın.'; },
    };
    phone.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) acts[b.dataset.act]?.(b); });
    again.addEventListener('click', () => {
      clearTimeout(timer); note.classList.remove('show');
      [...phone.querySelectorAll('.screen')].forEach((s, i) => { s.innerHTML = start[i]; });
      tries.forEach((x, i) => { x.textContent = first[i]; });
      again.hidden = true; arm(); t.show(0);
    });
    t.items.forEach((it) => it.querySelector('.tab3-head').addEventListener('click', () => { clearTimeout(timer); note.classList.remove('show'); }));
    arm();
  });
})();
