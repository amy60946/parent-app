// Mağaza görüntüleri için deneme verisini sadeleştirir (yalnız tarayıcı deposu; uygulama kodu değişmez)
module.exports.prep = async (p, { clinic = false } = {}) => {
  // clinic: Uzmanım ekranı için uzman bağlantısı kalır
  await p.goto('file://' + (process.env.PREVIEW_APP_HTML || require('path').resolve(__dirname, '../../preview/out/app.html')));
  await p.waitForTimeout(2500);
  const cb = p.getByRole('checkbox');
  for (let i = 0; i < 2; i++) { try { await cb.nth(i).click({ timeout: 2000, position: { x: 14, y: 14 } }); await p.waitForTimeout(300); } catch {} }
  try { await p.getByText('Devam et', { exact: true }).click({ timeout: 2000 }); } catch {}
  await p.waitForTimeout(1500);
  await p.evaluate(({ clinic }) => {
    const K = 'pofi-onizleme-v14';
    const db = JSON.parse(localStorage.getItem(K));
    const U = 'demo-user';
        db.intake_answers.push({ id: 'ia-1', user_id: U, family_id: 'demo-family', child_id: null, key: 'done', value: '1' });
    db.family_subscriptions.push({ family_id: 'demo-family', plan: 'premium', status: 'active', period_end: new Date(Date.now() + 300 * 864e5).toISOString() });
    db.clinic_invites = [];
    db.clinic_task_suggestions = db.clinic_task_suggestions.filter(x => x.status !== 'pending');
    if (!clinic) { db.care_modules = []; db.clinic_links = []; db.clinic_goals = []; }
    // Kurgusal olduğu açık uzman ve kurum adları (Apple 2.3.9; ClinicApp mağaza paketiyle aynı yaklaşım)
    db.clinics.forEach(c => { c.name = 'Örnek Danışmanlık Merkezi'; });
    db.clinicians.forEach((m, i) => { m.name = ['Elif Örnek', 'Deniz Örnek', 'Can Örnek'][i % 3]; m.title = 'Aile danışmanı'; });
    // Ebeveynin kendi görevleri bu çekimde yok (ana sayfadaki "Ben %0" satırı karışıklık yaratıyor)
    db.parent_assignments = []; db.parent_completions = [];
    // Örnek ödüllerden "Ekran süresi" çıkar (mağaza görselinde tartışma yaratmasın)
    db.rewards = db.rewards.filter(r => r.title !== 'Ekran süresi');
    // Son 6 haftanın tamamlanan görevleri: grafikler dolu, seri gerçekçi (eskiden yeniye artan oran)
    const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    db.tasks.forEach(t => { if (t.recurring) t.start_date = iso(-42); });
    const today = iso(0);
    db.completions = db.completions.filter(c => c.date >= today);
    { const at = new Date(); at.setHours(8, 12, 0, 0); db.completions.push({ id: 'st-arven-today', family_id: 'demo-family', task_id: 'k-yatak', child_id: 'c-arven', date: today, status: 'approved', created_at: at.toISOString(), child_done_at: at.toISOString(), decline_reason: null }); }
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const plan = { 'c-nazli': ['k-yatak', 'k-kitap', 'k-dis', 'k-yuruyus'], 'c-arven': ['k-yatak', 'k-dis', 'k-yuruyus'] };
    for (const [child, tasks] of Object.entries(plan)) for (const tid of tasks) for (let d = -41; d <= -1; d++) {
      const p = (child === 'c-nazli' ? 0.5 : 0.4) + 0.45 * (41 + d) / 41;
      if (d >= -6 && child === 'c-nazli' || rnd() < p) {
        const at = new Date(); at.setDate(at.getDate() + d); at.setHours(tid === 'k-dis' ? 21 : 8, 5 + Math.floor(rnd() * 20), 0, 0);
        db.completions.push({ id: 'st-' + child + tid + d, family_id: 'demo-family', task_id: tid, child_id: child, date: iso(d), status: 'approved', created_at: at.toISOString(), child_done_at: at.toISOString(), decline_reason: null });
      }
    }
    localStorage.setItem(K, JSON.stringify(db));
  }, { clinic });
  await p.reload();
  await p.waitForTimeout(2500);
  const close = p.getByLabel('Kapat', { exact: true });
  for (let i = 0; i < 3; i++) { try { await close.first().click({ timeout: 800 }); await p.waitForTimeout(400); } catch { break; } }
};
