// Alternatif 2 · Tek ekran: bölüm sabitlenir; kaydırma ilerledikçe etkin adım değişir (yazı + telefondaki ekran).
(() => {
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const head = () => document.querySelector('.top')?.offsetHeight ?? 0;
  document.querySelectorAll('[data-pin]').forEach((sec) => {
    const texts = [...sec.querySelectorAll('.pin-text')], screens = [...sec.querySelectorAll('.stack .screen')];
    const dots = [...sec.querySelectorAll('.pin-dot')], count = sec.querySelector('.pin-count');
    const n = texts.length;
    sec.style.setProperty('--n', n);
    sec.classList.add('is-pinned');
    let cur = -1;
    const set = (k) => {
      if (k === cur) return; cur = k;
      texts.forEach((t, i) => t.classList.toggle('on', i === k));
      screens.forEach((s, i) => s.classList.toggle('on', i === k));
      dots.forEach((d, i) => { d.classList.toggle('on', i === k); d.setAttribute('aria-current', i === k ? 'step' : 'false'); });
      if (count) count.textContent = `${k + 1} / ${n}`;
    };
    const span = () => Math.max(1, sec.offsetHeight - innerHeight + head());
    const sync = () => {
      sec.style.setProperty('--head', head() + 'px');
      const p = Math.min(1, Math.max(0, (head() - sec.getBoundingClientRect().top) / span()));
      set(Math.min(n - 1, Math.floor(p * n)));
    };
    dots.forEach((d, i) => d.addEventListener('click', () => {
      const top = scrollY + sec.getBoundingClientRect().top - head() + span() * (i + 0.5) / n;
      scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    }));
    let wait = false;
    addEventListener('scroll', () => { if (wait) return; wait = true; requestAnimationFrame(() => { wait = false; sync(); }); }, { passive: true });
    addEventListener('resize', sync); sync();
  });
})();
