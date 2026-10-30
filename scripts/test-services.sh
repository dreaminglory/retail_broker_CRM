#!/usr/bin/env bash
# Runs Vitest with the service integration suites switched on, and prints coverage (AD-043).
# Needs a running stack (npm run stack:up). CI runs this too.
#
#   npm run test:services                                   # everything
#   npm run test:services -- src/domain/inquiries           # one area
set -euo pipefail

cd "$(dirname "$0")/.."

STATUS_ENV="$(npx --yes supabase@2.122.0 status -o env)" # same CLI version as CI
env_value() {
  printf '%s\n' "$STATUS_ENV" | sed -n "s/^$1=\"\(.*\)\"$/\1/p"
}

export SUPABASE_TEST_URL="$(env_value API_URL)"
export SUPABASE_TEST_ANON_KEY="$(env_value ANON_KEY)"
export SUPABASE_TEST_SERVICE_ROLE_KEY="$(env_value SERVICE_ROLE_KEY)"
if [ -z "$SUPABASE_TEST_URL" ] || [ -z "$SUPABASE_TEST_ANON_KEY" ] || [ -z "$SUPABASE_TEST_SERVICE_ROLE_KEY" ]; then
  echo "test:services: could not read the stack's URL and keys. Is it running? Try npm run stack:up." >&2
  exit 1
fi

npx vitest run --coverage "$@"
