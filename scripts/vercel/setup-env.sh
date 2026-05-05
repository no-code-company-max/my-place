#!/usr/bin/env bash
#
# Carga las env vars del .env.local al proyecto Vercel linkeado.
# Pre-requisitos:
#   1. `vercel link` ya corrido (existe `.vercel/project.json`).
#   2. .env.local presente en la raíz.
#
# Uso:
#   ./scripts/vercel/setup-env.sh                  # carga en preview
#   ./scripts/vercel/setup-env.sh production       # carga en production
#
# Lo que hace:
#   - Para cada var en la lista (whitelist), lee el value de .env.local y lo
#     pushea via `vercel env add`. Skip las E2E_* (no van a Vercel).
#   - DATABASE_URL: reescribe `connection_limit=10` → `connection_limit=1`
#     (gotcha CLAUDE.md: serverless requiere 1, sino satura el pool).
#   - NEXT_PUBLIC_APP_URL/DOMAIN: usa placeholder "TBD-after-first-deploy" para
#     que la build inicial no falle. Después del primer deploy hay que update
#     manual con la URL real.
#   - Idempotente: si la var ya existe en Vercel, hace `rm` antes del `add`
#     (para que un re-run sobreescriba).

set -euo pipefail

ENV_TARGET="${1:-preview}"

if [[ ! -f .env.local ]]; then
  echo "❌ .env.local no encontrado en $(pwd)"
  exit 1
fi

if [[ ! -f .vercel/project.json ]]; then
  echo "❌ Vercel project no linkeado. Corré primero: vercel link"
  exit 1
fi

# Whitelist explícita — solo subimos las vars que la app necesita en runtime.
# E2E_TEST_SECRET intencionalmente afuera (gate del endpoint /api/test/sign-in,
# debe quedar SOLO en local/dev).
VARS_REQUIRED=(
  DATABASE_URL
  DIRECT_URL
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  APP_EDIT_SESSION_SECRET
  CRON_SECRET
)

VARS_OPTIONAL=(
  RESEND_API_KEY
  EMAIL_FROM
)

# Estas viven con placeholder hasta el primer deploy; después se updatean
# con la URL real de Vercel preview.
VARS_PLACEHOLDER=(
  NEXT_PUBLIC_APP_URL
  NEXT_PUBLIC_APP_DOMAIN
)

read_env() {
  local name="$1"
  grep -E "^${name}=" .env.local | head -1 | cut -d= -f2- | sed 's/^"\(.*\)"$/\1/'
}

push_var() {
  local name="$1"
  local value="$2"
  # rm idempotente — si no existe, exit non-zero pero seguimos.
  vercel env rm "$name" "$ENV_TARGET" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$name" "$ENV_TARGET"
}

echo "==> Cargando env vars en target: $ENV_TARGET"
echo

for var in "${VARS_REQUIRED[@]}"; do
  value="$(read_env "$var")"
  if [[ -z "$value" ]]; then
    echo "❌ $var no está en .env.local — agregalo o quitarlo de VARS_REQUIRED"
    exit 1
  fi
  if [[ "$var" == "DATABASE_URL" ]]; then
    # Gotcha CLAUDE.md: serverless = connection_limit=1.
    value="$(echo "$value" | sed 's/connection_limit=10/connection_limit=1/')"
    echo "🔧 $var: forced connection_limit=1 (gotcha serverless)"
  fi
  echo "→ $var"
  push_var "$var" "$value"
done

echo
for var in "${VARS_OPTIONAL[@]}"; do
  value="$(read_env "$var")"
  if [[ -z "$value" ]]; then
    echo "⚠️  $var vacía en .env.local — skip (la app cae a fallback en runtime)"
    continue
  fi
  echo "→ $var"
  push_var "$var" "$value"
done

echo
for var in "${VARS_PLACEHOLDER[@]}"; do
  echo "→ $var = TBD-after-first-deploy (update manual post-deploy)"
  push_var "$var" "TBD-after-first-deploy"
done

echo
echo "✅ env vars cargadas en target: $ENV_TARGET"
echo
echo "Próximo paso: 'vercel' para el primer deploy preview."
echo "Después actualizá NEXT_PUBLIC_APP_URL y NEXT_PUBLIC_APP_DOMAIN con la URL real:"
echo "  vercel env rm NEXT_PUBLIC_APP_URL $ENV_TARGET --yes"
echo "  vercel env add NEXT_PUBLIC_APP_URL $ENV_TARGET"
echo "  # (pegás la URL del preview, ej: https://place-xxx.vercel.app)"
echo "  vercel --force"
