#!/usr/bin/env bash
# src/data/intake.ts → ortak/veri/tanisma_sorulari.json (yönetim paneli soru ve seçenek adlarını buradan okur).
# Soru metni, anahtar ya da seçenek değişince çalıştır: bash tools/intake_json.sh ../ortak/veri/tanisma_sorulari.json
set -euo pipefail
out="${1:?çıktı yolu gerekli}"
tmp="$(mktemp -d)"
npx tsc src/data/intake.ts --ignoreConfig --outDir "$tmp" --module commonjs --target es2020 --skipLibCheck
cat > "$tmp/gen.js" <<'JS'
const m = require('./intake.js');
const q = (s, who) => ({ key: s.key, who, type: s.multi ? 'multi' : 'single', health: !!s.health,
  title: (s.prefix ? s.prefix + ' ' : '') + s.title, options: s.options.map((o) => ({ key: o.key, label: o.label, ...(o.exclusive ? { exclusive: true } : {}) })) });
const questions = [
  ...m.familySteps.filter((s) => s.kind === 'question').map((s) => q(s, 'parent')),
  ...m.childSteps('{ad}').filter((s) => s.kind === 'question').map((s) => q(s, 'child')),
  ...m.relateSteps.map((r) => ({ key: r.key, who: 'parent', type: 'single', health: false, title: `Bu sana tanıdık geliyor mu? "${r.quote}"`,
    options: [{ key: 'yes', label: 'Evet' }, { key: 'no', label: 'Hayır' }] })),
];
process.stdout.write(JSON.stringify({
  _doc: "ParentApp tanışma soruları (ilk kurulum). Kaynak: parent-app/src/data/intake.ts (tools/intake_json.sh ile üretilir); sözleşme sozlesme/durumlar.md P16, akislar.md 16. Sıra uygulamadaki adım sırasıdır. who: parent = aile/ebeveyn sorusu (child_id boş), child = çocuk başına (child_id dolu). {ad}: çocuğun adı. health: true = isteğe bağlı sağlık sorusu, 'prefer_not' dışındaki yanıt açık rıza ister (consent_version). exclusive: seçilince diğerleri kalkar. Yanıtlar intake_answers.answer içinde seçenek anahtarları dizisidir.",
  version: m.INTAKE_VERSION, consent_version: m.HEALTH_CONSENT, questions }, null, 2) + '\n');
JS
node "$tmp/gen.js" > "$out"
rm -rf "$tmp"
echo "✓ $out"
