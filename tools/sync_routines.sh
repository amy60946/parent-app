#!/usr/bin/env bash
# ortak/veri/hazir_rutinler.json → src/data/routines.json (hazır rutinlerin tek kaynağı ortak; ClinicApp de aynı dosyayı kullanır).
# Kullanım: bash tools/sync_routines.sh ../ortak/veri/hazir_rutinler.json
set -euo pipefail
src="${1:?ortak/veri/hazir_rutinler.json yolu gerekli}"
node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); if(!Array.isArray(d.routines)||!d.routines.length) throw new Error("routines yok"); for (const r of d.routines) for (const i of r.items) if(!/^\d\d:\d\d$/.test(i.time)) throw new Error("saat: "+r.id)' "$src"
cp "$src" src/data/routines.json
echo "✓ src/data/routines.json ($(node -e 'console.log(require("./src/data/routines.json").routines.length)') rutin)"
