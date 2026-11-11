// Alternatif 1 · Kaydır: ekranın ortasına en yakın yazı etkin olur; sabit telefondaki ekran ona göre değişir.
(() => {
  document.querySelectorAll('[data-story]').forEach((story) => {
    const beats = [...story.querySelectorAll('.beat')], screens = [...story.querySelectorAll('.story-stage .screen')], dots = [...story.querySelectorAll('.dots span')];
    let cur = -1;
    const set = (k) => {
      if (k === cur) return; cur = k;
      beats.forEach((b, i) => b.classList.toggle('on', i === k));
      screens.forEach((s, i) => s.classList.toggle('on', i === k));
      dots.forEach((d, i) => d.classList.toggle('on', i === k));
    };
    const pick = () => {
      const mid = innerHeight / 2; let best = 0, dist = Infinity;
      beats.forEach((b, i) => { const r = b.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < dist) { dist = d; best = i; } });
      set(best);
    };
    let wait = false;
    addEventListener('scroll', () => { if (wait) return; wait = true; requestAnimationFrame(() => { wait = false; pick(); }); }, { passive: true });
    addEventListener('resize', pick); pick();
  });
})();
