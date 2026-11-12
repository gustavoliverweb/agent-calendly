#!/usr/bin/env bash
# Operaciones de base de datos contra el proyecto Supabase en la nube.
# Usa el pooler en modo transacción (puerto 6543): el 5432 no conecta
# desde algunas redes/VPN. Nunca imprime la contraseña.
#
#   scripts/db.sh status   → migraciones locales vs remotas
#   scripts/db.sh dry-run  → qué se aplicaría, sin aplicar nada
#   scripts/db.sh push     → aplica las migraciones pendientes
#   scripts/db.sh types    → regenera lib/supabase/database.types.ts
#   scripts/db.sh test [migración.sql…]
#                          → pruebas de aislamiento entre empresas dentro de
#                            una transacción que se deshace (no deja nada).
#                            Con migraciones, las aplica antes en la misma
#                            transacción: sirve para probarlas sin aplicarlas.
set -euo pipefail
cd "$(dirname "$0")/.."

# Solo las variables que usa (el resto de .env.local puede no ser shell válido,
# p. ej. valores con espacios sin comillas).
set -a
source <(grep -E '^(SUPABASE_PROJECT_REF|SUPABASE_DB_PASSWORD|SUPABASE_POOLER_HOST)=' .env.local | sed 's/[[:space:]]*#.*$//')
set +a
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
  test)
    shift
    { echo "begin;"; for m in "$@"; do cat "$m"; done; cat tests/db/aislamiento.sql; echo "rollback;"; } \
      | psql "$URL" -v ON_ERROR_STOP=1 -q 2>&1 | redact | grep -E "NOTICE|ERROR|FALLO" ;;
  *) echo "Uso: scripts/db.sh status|dry-run|push|types|test"; exit 1 ;;
esac
