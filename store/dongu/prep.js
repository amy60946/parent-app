// "A · Döngü" mağaza görselleri için deneme verisi (yalnız tarayıcı deposu; uygulama ve preview/ kodu değişmez).
// Temel: store/capture/prep.js (koşullar onaylı, Premium etkin, uzman daveti yok, kurgusal uzman/kurum adları).
// Tek hikâye: çocuk "Deniz", "Sabah rutini" (4 adım), öne çıkan adım "Dişlerini fırçala".
//   state 'pending'  : bugün "Sabah yatağını topla" onaylı, "Dişlerini fırçala" 08:10'da yapıldı, onay bekliyor (1, 3, 5, 6. kare)
//   state 'approved' : "Dişlerini fırçala" da onaylandı, +1 Güneş Taşı (7. kare)
//   state 'all'      : sabah rutininin 4 adımı da onaylı (4. kare, haftalık görünüm)
// Saat: capture.js tarayıcı saatini 19 Kasım 2026 Perşembe 09:41'e (Europe/Istanbul) sabitler; tarihler buna göre.
module.exports.prep = async (p, { clinic = false, state = 'pending' } = {}) => {
  await p.goto('file://' + (process.env.PREVIEW_APP_HTML || require('path').resolve(__dirname, '../../preview/out/app.html')));
  await p.waitForTimeout(2500);
  const cb = p.getByRole('checkbox');
  for (let i = 0; i < 2; i++) { try { await cb.nth(i).click({ timeout: 2000, position: { x: 14, y: 14 } }); await p.waitForTimeout(300); } catch {} }
  try { await p.getByText('Devam et', { exact: true }).click({ timeout: 2000 }); } catch {}
  await p.waitForTimeout(1500);
  await p.evaluate(({ clinic, state }) => {
    const K = 'pofi-onizleme-v14';
    const db = JSON.parse(localStorage.getItem(K));
    const U = 'demo-user', F = 'demo-family', C = 'c-nazli';
    const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    const at = (d, h, m) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
    const ago = (min) => new Date(Date.now() - min * 6e4).toISOString();

    // --- store/capture/prep.js ile aynı sadeleştirme ---
    db.intake_answers.push({ id: 'ia-1', user_id: U, family_id: F, child_id: null, key: 'done', value: '1' });
    db.family_subscriptions.push({ family_id: F, plan: 'premium', status: 'active', period_end: new Date(Date.now() + 300 * 864e5).toISOString() });
    db.clinic_invites = [];
    db.parent_assignments = []; db.parent_completions = [];
    db.clinics.forEach((c) => { c.name = 'Örnek Danışmanlık Merkezi'; });
    db.clinicians.forEach((m, i) => { m.name = ['Elif Örnek', 'Ayşe Örnek', 'Can Örnek'][i % 3]; m.title = 'Aile danışmanı'; });

    // --- Çocuk: Deniz ---
    const deniz = db.children.find((c) => c.id === C);
    deniz.name = 'Deniz'; deniz.birthday = '2019-03-14';

    // --- Görevler: Deniz'in "Sabah rutini" + Arven'in tek akşam adımı ---
    db.tasks = []; db.task_assignments = []; db.completions = [];
    const RT = { routine_id: 'rt-sabah', routine_title: 'Sabah rutini', routine_icon: 'sunny-outline' };
    const task = (id, title, emoji, skill, reminder, kids, routinePos) => {
      db.tasks.push({ id, family_id: F, title, emoji, skill, description: '', start_date: iso(-60), recurring: true, end_date: null, reminder,
        requires_review: true, created_at: ago(90000 - db.tasks.length), repeat_kind: 'daily', repeat_days: [], sort_order: db.tasks.length,
        ...(routinePos == null ? {} : { ...RT, routine_position: routinePos }) });
      kids.forEach((child_id) => db.task_assignments.push({ task_id: id, child_id, family_id: F, difficulty: 'easy', coins: 5 }));
    };
    const STEPS = [
      ['s-yatak', 'Sabah yatağını topla', '🛏️', 'Sorumluluk', '07:30'],
      ['s-dis', 'Dişlerini fırçala', '🪥', 'Öz Bakım', '07:35'],
      ['s-el', 'Ellerini yıka', '🧼', 'Öz Bakım', '07:40'],
      ['s-canta', 'Okul çantanı kaldır', '🎒', 'Sorumluluk', '07:50'],
    ];
    STEPS.forEach(([id, title, emoji, skill, rem], i) => task(id, title, emoji, skill, rem, [C], i));
    task('a-oyuncak', 'Oyuncaklarını topla', '🧸', 'Sorumluluk', '19:00', ['c-arven'], null);

    const done = (task_id, child_id, d, status, h, m) => db.completions.push({ id: `st-${task_id}-${child_id}-${d}`, family_id: F, task_id, child_id, date: iso(d),
      status, created_at: at(d, h, m), child_done_at: at(d, h, m), decline_reason: null, ...(status === 'approved' ? { reviewed_at: at(d, h, m + 20), reviewed_by: U } : {}) });

    // Bugün
    done('s-yatak', C, 0, 'approved', 7, 34);
    done('s-dis', C, 0, state === 'pending' ? 'pending' : 'approved', 8, 10);
    if (state === 'all') { done('s-el', C, 0, 'approved', 8, 14); done('s-canta', C, 0, 'approved', 8, 21); }
    // Son 6 gün: "Dişlerini fırçala" 7 günün 6'sında (4. gün, yani 3 gün önce, yapılmadı); öteki adımlar da o gün eksik
    for (let d = -6; d <= -1; d++) {
      STEPS.forEach(([id, , , , rem], i) => {
        if (d === -3 && (id === 's-dis' || id === 's-canta')) return;
        const [h, m] = rem.split(':').map(Number);
        done(id, C, d, 'approved', h, m + ((d * 7 + i * 3) % 9 + 9) % 9);
      });
    }
    // Daha önceki 6 hafta: eskiden yeniye artan düzen (tekrarlanabilir sözde rastgele)
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let d = -48; d <= -7; d++) STEPS.forEach(([id, , , , rem], i) => {
      if (rnd() < 0.45 + 0.45 * (48 + d) / 41) { const [h, m] = rem.split(':').map(Number); done(id, C, d, 'approved', h, m + Math.floor(rnd() * 12)); }
    });
    for (let d = -20; d <= -1; d++) if (d % 3) done('a-oyuncak', 'c-arven', d, 'approved', 19, 10);

    // --- Güneş Taşı: Deniz'in hareketleri (onaylanan adımlar, bir ödül) ---
    db.sun_stone_ledger = [];
    const stone = (child_id, amount, reason, min, note = null) => db.sun_stone_ledger.push({ id: db.sun_stone_ledger.length + 1, family_id: F, child_id, amount, reason, ref: 'st-' + db.sun_stone_ledger.length, note, created_at: ago(min) });
    [2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1].forEach((n, i) => stone(C, n, 'task', 14000 - i * 900));
    stone(C, -8, 'reward', 9000, 'Film gecesi');
    if (state !== 'pending') stone(C, 1, 'task', 1);
    [1, 1, 1, 2].forEach((n, i) => stone('c-arven', n, 'task', 3000 - i * 400));

    // --- Ödüller ---
    db.rewards = db.rewards.filter((r) => !['Ekran süresi', 'Parkta 30 dakika'].includes(r.title));
    const rw = (id, title, cost, icon, child_ids = []) => db.rewards.push({ id, family_id: F, title, kind: 'item', cost, unit: null, unit_amount: null, child_ids, icon, active: true, created_at: ago(20000 - db.rewards.length) });
    rw('st-park', 'Hafta sonu parka gitmek', 12, 'football');
    rw('st-kahvalti', 'Pazar kahvaltısını o seçsin', 8, 'restaurant');
    rw('st-oyun', 'Arkadaşıyla oyun günü', 15, 'people');
    db.reward_requests = [];

    // --- Davranış kaydı: Deniz, dün akşam ---
    db.abc_events = [];
    const abc = (d, hhmm, part, a, b, c, intensity) => { const [h, m] = hhmm.split(':').map(Number);
      db.abc_events.push({ id: 'abc-' + d, family_id: F, child_id: C, occurred_at: at(d, h, m), antecedent: a, behavior: b, consequence: c, intensity, day_part: part, group_id: null, created_by: U, created_at: at(d, h, m + 15) }); };
    abc(-1, '20:40', 'evening', 'Ekran süresi bitti', 'Diş fırçalamak istemedi, banyoya gitmedi', 'Birlikte fırçaladık', 2);
    abc(-6, '07:45', 'morning', 'Kahvaltı uzadı', 'Çantasını hazırlamak istemedi', 'Birlikte listeye baktık', 2);
    abc(-12, '20:30', 'evening', 'Oyun yarıda kaldı', 'Söylendi ama oyunu bıraktı', 'Teşekkür ettik', 1);

    // --- Uzman: yalnız Deniz için rızalı bağlantı, tek bekleyen öneri ---
    db.clinic_links = db.clinic_links.filter((l) => l.status === 'active');
    db.clinic_task_suggestions = [];
    const link = db.clinic_links[0];
    if (clinic && link) {
      db.clinic_task_suggestions.push({ id: 'sg-kitap', link_id: link.id, clinic_id: link.clinic_id, family_id: F, child_id: C, title: 'Yatmadan önce kitap oku', emoji: '📖',
        skill: 'Odaklanma', difficulty: 'easy', recurring: true, note: '', status: 'pending', created_by: link.clinician_id, created_at: ago(120), decided_at: null,
        description: 'Yatmadan önce 10 dakika birlikte kitap okuyun.', coins: 5, repeat_kind: 'daily', repeat_days: [], reminder: '20:30', requires_review: true, kind: 'new' });
      // Uzmanım ekranı sade: randevu, eğitim görevi ve hedef davranış yok; öneri ve paylaşım bölümü ilk ekranda görünür
      db.clinic_sessions = [];
      Object.keys(db).filter((t) => /^parent_training/.test(t)).forEach((t) => { db[t] = []; });
      db.clinic_target_behaviors = [];
    } else { db.care_modules = []; db.clinic_links = []; db.clinic_goals = []; }

    // --- Bildirim ve mesajlar: Deniz'e göre, okunmuş (rozet sayıları sade kalsın) ---
    db.notifications = [
      { id: 1, user_id: U, app: 'parent', kind: 'task_done', title: 'Deniz adımı yaptı: Dişlerini fırçala', body: 'Onayını bekliyor.', data: { child_id: C, task_id: 's-dis' }, child_id: C, created_at: at(0, 8, 10), read_at: state === 'pending' ? null : at(0, 8, 30) },
    ];
    db.messages.forEach((m) => { m.read_at = m.read_at || ago(60); m.body = (m.body || '').replace(/Nazlı/g, 'Deniz'); });

    localStorage.setItem(K, JSON.stringify(db));
    // Tek seferlik ipuçları görünmesin (AsyncStorage web'de localStorage)
    ['hint-plus-longpress-v2', 'hint-reward-new', 'onboarding-v1', 'intro-rewards-v2'].forEach((k) => localStorage.setItem(k, '1'));
    localStorage.setItem('push-ask', `2:${Date.now()}`);
  }, { clinic, state });
  await p.reload();
  await p.waitForTimeout(2500);
  const close = p.getByLabel('Kapat', { exact: true });
  for (let i = 0; i < 3; i++) { try { await close.first().click({ timeout: 800 }); await p.waitForTimeout(400); } catch { break; } }
};
