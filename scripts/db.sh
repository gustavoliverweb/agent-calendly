#!/usr/bin/env bash
# Operaciones de base de datos contra el proyecto Supabase en la nube.
# Usa el pooler en modo transacción (puerto 6543): el 5432 no conecta
# desde algunas redes/VPN. Nunca imprime la contraseña.
#
#   scripts/db.sh status   → migraciones locales vs remotas
#   scripts/db.sh dry-run  → qué se aplicaría, sin aplicar nada
#   scripts/db.sh push     → aplica las migraciones pendientes
#   scripts/db.sh types    → regenera lib/supabase/database.types.ts
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env.local; set +a
: "${SUPABASE_PROJECT_REF:?Falta SUPABASE_PROJECT_REF en .env.local}"
: "${SUPABASE_DB_PASSWORD:?Falta SUPABASE_DB_PASSWORD en .env.local}"

PW=$(python3 -c 'import urllib.parse,os;print(urllib.parse.quote(os.environ["SUPABASE_DB_PASSWORD"],safe=""))')
HOST="${SUPABASE_POOLER_HOST:-aws-1-eu-central-1.pooler.supabase.com}"
URL="postgresql://postgres.$SUPABASE_PROJECT_REF:$PW@$HOST:6543/postgres?sslmode=require"
redact() { sed "s/$PW/<pass>/g"; }

case "${1:-}" in
  status)  pnpm exec supabase migration list --db-url "$URL" 2>&1 | redact ;;
  dry-run) pnpm exec supabase db push --dry-run --db-url "$URL" 2>&1 | redact ;;
  push)    pnpm exec supabase db push --db-url "$URL" 2>&1 | redact ;;
  # --linked usa la API de Supabase (no Docker).
  types)   pnpm exec supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts && echo "Tipos regenerados" ;;
  *) echo "Uso: scripts/db.sh status|dry-run|push|types"; exit 1 ;;
esac
