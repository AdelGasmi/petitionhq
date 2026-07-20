#!/bin/bash
# setup-cron.sh — install ALL PetitionHQ cron jobs on the production host.
#
# Run on the prod server after a deploy. Idempotent: it strips any existing
# PetitionHQ cron lines and reinstalls the full set, so re-running it (e.g.
# after rotating CRON_SECRET) is always safe.
#
# Usage:
#   CRON_SECRET=... ./scripts/setup-cron.sh
# Optional overrides:
#   APP_CONTAINER (default: petitionhq-app-1)
#   INTERNAL_URL  (default: http://0.0.0.0:3000)   # hit the app from inside the host
#
# History: before 2026-06-17 only `process-dossiers` was ever installed, so the
# auto-refund, nurture, recommender-nudge and pilot-release automations existed
# in code but were never scheduled. This installs all of them.

set -euo pipefail

CRON_SECRET="${CRON_SECRET:?CRON_SECRET required}"
APP_CONTAINER="${APP_CONTAINER:-petitionhq-app-1}"
INTERNAL_URL="${INTERNAL_URL:-http://0.0.0.0:3000}"

# Each entry: "<cron schedule>|<endpoint>". Schedules are staggered so they
# never fire at the same minute.
JOBS=(
  "*/5 * * * *|process-dossiers"        # every 5 min — render dossier PDFs
  "0 8 * * *|refund-ghosted"            # daily 08:00 — auto-refund 14d-ghosted claims
  "15 8 * * *|release-ghosted-pilots"   # daily 08:15 — release stale pilot deliveries
  "0 9 * * *|remind-recommenders"       # daily 09:00 — nudge ghosted recommenders (5d/10d)
  "0 14 * * *|nurture"                  # daily 14:00 — nurture drip (day 1/7/30)
)

req() {
  # docker exec wget against the internal port — matches the proven prod pattern
  # and bypasses Caddy/rate-limiting. Bearer token authenticates the cron route.
  echo "docker exec ${APP_CONTAINER} wget -q -O- --header=\"Authorization: Bearer ${CRON_SECRET}\" --post-data=\"\" ${INTERNAL_URL}/api/cron/$1"
}

# Build the new block, dropping any prior petitionhq cron lines (app endpoints
# and marker-tagged maintenance lines alike).
TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "/api/cron/" | grep -v "petitionhq-maintenance" > "$TMP" || true
for job in "${JOBS[@]}"; do
  schedule="${job%%|*}"
  endpoint="${job##*|}"
  echo "${schedule} $(req "$endpoint") >> /var/log/petitionhq-cron.log 2>&1" >> "$TMP"
done

# ── Host maintenance ──────────────────────────────────────────────────────────
# Weekly buildkit-cache prune. Every `docker build` deploy grows the cache
# unboundedly; it filled the disk once (full db:error outage) and was back to
# 46GB / 73% disk by 2026-07-02. `until=72h` keeps the newest layers so the
# next deploy stays fast while the cache can never accumulate for months.
echo "30 5 * * 1 docker builder prune -af --filter until=72h >> /var/log/petitionhq-prune.log 2>&1 # petitionhq-maintenance" >> "$TMP"

crontab "$TMP"
rm -f "$TMP"

echo "[setup-cron] Installed $( crontab -l | grep -c '/api/cron/' ) cron jobs + $( crontab -l | grep -c 'petitionhq-maintenance' ) maintenance job:"
crontab -l | grep -oE "/api/cron/[a-z-]+" | sort
crontab -l | grep "petitionhq-maintenance" | sed 's/ >>.*//'
