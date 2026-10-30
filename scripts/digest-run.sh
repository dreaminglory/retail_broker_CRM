#!/usr/bin/env bash
# Calls the daily digest route of the running dev server (AD-042). Mail lands in Mailpit,
# http://localhost:54324. Needs `npm run dev` and CRON_SECRET in .env.local (npm run stack:up).
#
#   npm run digest:run                          # as of now: sends only if it is 08:xx on a weekday
#   npm run digest:run -- 2026-11-02T06:10:00Z  # as of that instant: Monday 08:10 in Sofia
set -euo pipefail

cd "$(dirname "$0")/.."

env_value() {
  sed -n "s/^$1=\(.*\)$/\1/p" .env.local 2>/dev/null | tail -n 1 | tr -d '\r'
}

SECRET="$(env_value CRON_SECRET)"
BASE_URL="$(env_value NEXT_PUBLIC_APP_URL)"
if [ -z "$SECRET" ]; then
  echo "digest:run: CRON_SECRET is not in .env.local. Run npm run stack:up (or add it yourself)." >&2
  exit 1
fi

QUERY=""
if [ $# -gt 0 ]; then
  QUERY="?now=$1"
fi

curl --silent --show-error --fail-with-body \
  --header "Authorization: Bearer $SECRET" \
  "${BASE_URL:-http://localhost:3000}/api/cron/daily-digest$QUERY"
echo
