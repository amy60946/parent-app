#!/usr/bin/env bash
# Klinik SaaS önerisini yerel PostgreSQL'de dener (oyun şeması ile birlikte).
# Gerekenler: psql, çalışan bir sunucu, pofi-adasi deposu (POFI, varsayılan ../../../pofi-adasi).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
pofi="${POFI:-$here/../../../pofi-adasi}"
db=clinic_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db"
run() { psql -q -t -o /dev/null -v ON_ERROR_STOP=1 -d "$db" -f "$1"; }
run "$pofi/supabase/test/supabase_stub.sql"
for f in "$here"/../migrations/*.sql; do run "$f"; done
for f in "$pofi"/supabase/proposed/*.sql; do run "$f"; done
for f in "$here"/../proposed/*.sql; do run "$f"; run "$f"; done   # iki kez: tekrar çalıştırmak zarar vermemeli
run "$here/test_clinic.sql"
echo "TAMAM: tüm klinik testleri geçti"
