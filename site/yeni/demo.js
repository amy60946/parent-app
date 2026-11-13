// Moyo tanıtım sayfası: üstteki gösterim kendiliğinden oynar (bir seferde tek değişiklik, 1–2 sn duraklar, ~10 sn döngü).
// JS yoksa ya da "hareketi azalt" açıksa sayfa durağan hâliyle tamdır (bildirim + onay bekleyen görünür).
(function () {
  var stage = document.querySelector('[data-gosterim]');
  if (stage) {
    // Oyun tableti + gerçek Moyo onay ekranı. Bir seferde tek değişiklik, adımlar 1–2 sn, döngü ~11 sn.
    // JS yoksa ya da "hareketi azalt" açıksa durağan hâl: tablette "Onay bekliyor", telefonda onay ekranı.
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var btn = document.getElementById('gosterim-dur');
    var timers = [], playing = false, userPaused = false, visible = true;
    var set = function (cls, on) { stage.classList.toggle(cls, on); };
    var place = function (dotSel, targetSel) {            // parmak noktası: hedefin tam ortasına
      var dot = stage.querySelector(dotSel), target = stage.querySelector(targetSel);
      var p = dot.offsetParent.getBoundingClientRect(), r = target.getBoundingClientRect();
      dot.style.left = (r.left + r.width / 2 - p.left) + 'px'; dot.style.top = (r.top + r.height / 2 - p.top) + 'px';
    };
    var all = ['s-done', 's-push', 's-ok', 's-dot-a', 's-dot-b', 's-tap'];
    var rest = function () { all.forEach(function (c) { set(c, false); }); };
    var still = function () { rest(); set('s-done', true); };
    var steps = [
      [1400, function () { place('.nokta-a', '.dgm'); set('s-dot-a', true); }],   // çocuk: parmak "Yaptım"ın üstünde
      [900, function () { set('s-tap', true); }],
      [350, function () { set('s-tap', false); set('s-done', true); }],            // "Onay bekliyor"
      [900, function () { set('s-dot-a', false); }],
      [600, function () { set('s-push', true); }],                                 // ebeveyne bildirim
      [1900, function () { set('s-push', false); set('s-dot-b', true); }],         // ebeveyn: parmak "Onayla"nın üstünde
      [900, function () { set('s-tap', true); }],
      [350, function () { set('s-tap', false); set('s-ok', true); }],              // oyunda "Onaylandı"
      [700, function () { set('s-dot-b', false); }],
      [2600, function () { rest(); }],                                             // dinlen, baştan
      [600, function () { run(0); }]
    ];
    var run = function (i) { if (!playing) return; var s = steps[i]; if (!s) return; timers.push(setTimeout(function () { if (!playing) return; s[1](); if (i < steps.length - 1) run(i + 1); }, s[0])); };
    var stop = function () { playing = false; timers.forEach(clearTimeout); timers = []; };
    var start = function () { if (playing || reduce || userPaused || !visible || document.hidden) return; playing = true; rest(); run(0); };
    stage.classList.remove('yok-js');
    if (reduce) { btn.hidden = true; } else {
      btn.addEventListener('click', function () { userPaused = !userPaused; btn.textContent = userPaused ? 'Oynat' : 'Durdur'; btn.setAttribute('aria-pressed', userPaused ? 'true' : 'false'); if (userPaused) { stop(); still(); } else start(); });
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else { stop(); still(); } }, { threshold: 0.25 }).observe(stage);
      document.addEventListener('visibilitychange', function () { if (document.hidden) { stop(); still(); } else start(); });
      start();
    }
  }
  // Fiyat sayfası: aylık / yıllık
  var seg = document.querySelector('[data-donem]');
  if (seg) {
    var bs = [].slice.call(seg.querySelectorAll('button'));
    var show = function (d) { bs.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.d === d ? 'true' : 'false'); }); [].forEach.call(document.querySelectorAll('[data-donem-goster]'), function (el) { el.hidden = el.dataset.donemGoster !== d; }); };
    bs.forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.d); }); });
    show('yillik');
  }
  // Açılır menü: bağlantıya dokununca kapanır
  [].forEach.call(document.querySelectorAll('.acilir nav a'), function (a) { a.addEventListener('click', function () { a.closest('details').open = false; }); });
  // Yalnız önizleme: logo alternatifi (A / B / C)
  var pick = document.querySelector('.logo-sec');
  if (pick) {
    var pb = [].slice.call(pick.querySelectorAll('button'));
    var logo = function (v) { pb.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false'); }); [].forEach.call(document.querySelectorAll('[data-logo]'), function (el) { el.hidden = el.dataset.logo !== v; }); try { localStorage.setItem('moyo-kit-v', v); } catch (e) {} };
    pb.forEach(function (b) { b.addEventListener('click', function () { logo(b.dataset.v); }); });
    var v0 = 'a'; try { v0 = localStorage.getItem('moyo-kit-v') || 'a'; } catch (e) {}
    logo(/^[abc]$/.test(v0) ? v0 : 'a');
  }
})();
