#!/usr/bin/env bash
# Brings up local Supabase for the app and writes .env.local (AD-043, FR-TST-05).
# Safe to run again: a running dockerd or stack is reused.
#
#   npm run stack:up && npm run dev     # then sign in as owner@alpha.bg / password123
set -euo pipefail

cd "$(dirname "$0")/.."

SUPABASE="npx --yes supabase@2.122.0" # same CLI version as CI
# Not used by the app: the Studio UI, storage, realtime, edge functions, logging, pooler.
EXCLUDED="studio,imgproxy,vector,logflare,supavisor,edge-runtime,realtime,storage-api,postgres-meta"
DOCKERD_LOG="${TMPDIR:-/tmp}/dockerd.log"

# 1. Docker. Cloud sessions ship dockerd but don't start it.
if ! docker info >/dev/null 2>&1; then
  if ! command -v dockerd >/dev/null 2>&1; then
    echo "stack:up: Docker is not running and dockerd is not installed." >&2
    exit 1
  fi
  echo "stack:up: starting dockerd (log: $DOCKERD_LOG)"
  SUDO=""
  if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi
  $SUDO sh -c "nohup dockerd >'$DOCKERD_LOG' 2>&1 &"
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
  if ! docker info >/dev/null 2>&1; then
    echo "stack:up: dockerd did not come up within 60 s; see $DOCKERD_LOG" >&2
    exit 1
  fi
fi

# 2. Supabase. The first start pulls images and applies migrations and supabase/seed.sql.
$SUPABASE start -x "$EXCLUDED"

# 3. .env.local, from the running stack. An .env.local that this script did not
# write (for example one pointing at a cloud project) is kept as .env.local.bak.
MARKER="# Written by scripts/stack-up.sh"
if [ -f .env.local ] && ! head -n 1 .env.local | grep -qF "$MARKER"; then
  mv .env.local .env.local.bak
  echo "stack:up: moved your existing .env.local to .env.local.bak"
fi

STATUS_ENV="$($SUPABASE status -o env)"
env_value() {
  printf '%s\n' "$STATUS_ENV" | sed -n "s/^$1=\"\(.*\)\"$/\1/p"
}

API_URL="$(env_value API_URL)"
ANON_KEY="$(env_value ANON_KEY)"
SERVICE_ROLE_KEY="$(env_value SERVICE_ROLE_KEY)"
if [ -z "$API_URL" ] || [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "stack:up: could not read the stack's URL and keys from 'supabase status'." >&2
  exit 1
fi

cat > .env.local <<ENV
$MARKER
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV

echo "stack:up: ready. Run 'npm run dev' and sign in as owner@alpha.bg / password123."
