#!/bin/bash
# deploy.sh — pull, build, migrate, restart on the production server, with a
# pre-migration backup and an automatic rollback if the new container fails
# its post-deploy health check.
# Usage: ./scripts/deploy.sh
# Run from /opt/petitionhq on the server after git pull, or let it pull itself.
# Also the target of .github/workflows/deploy.yml (CI-gated automated deploy).

set -euo pipefail

echo "[deploy] Pulling latest code..."
git pull origin main

# Self-modifying-script guard. This file just pulled a possibly-new version
# of itself, but bash may have already buffered the OLD content before the
# pull landed on disk — so without this, every step below could silently
# keep running against the previous commit's copy of this exact script.
# That's exactly what happened on 2026-07-04: a health-check command was
# fixed, committed, and deployed, yet the failing run's timing (a full
# 15x2s retry budget exhausted on an app that was ready in 150ms) showed it
# never actually executed the fix. Re-exec forces a fresh read from disk.
if [[ -z "${DEPLOY_REEXECED:-}" ]]; then
  exec env DEPLOY_REEXECED=1 bash "$0" "$@"
fi

# Extract vars from .env without sourcing the whole file
# (sourcing fails on values containing shell metacharacters like < > in SMTP_FROM)
_env_get() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2-; }

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time — must be
# passed as --build-arg. Setting them only in docker-compose env has no effect.
NEXT_PUBLIC_TURNSTILE_SITE_KEY="${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-$(_env_get NEXT_PUBLIC_TURNSTILE_SITE_KEY)}"
if [[ -z "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}" ]]; then
  echo "[deploy] ERROR: NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set. Add it to .env." >&2
  exit 1
fi

# DB vars needed for migration step
POSTGRES_USER="${POSTGRES_USER:-$(_env_get POSTGRES_USER)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(_env_get POSTGRES_PASSWORD)}"
POSTGRES_DB="${POSTGRES_DB:-$(_env_get POSTGRES_DB)}"
if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "[deploy] ERROR: POSTGRES_PASSWORD is not set. Add it to .env." >&2
  exit 1
fi

# Remember what's currently live so a bad deploy can roll back to it. Written
# at the end of every successful run (below); absent on the very first deploy.
LAST_DEPLOYED_FILE=".last-deployed-sha"
PREV_SHA=""
[[ -f "$LAST_DEPLOYED_FILE" ]] && PREV_SHA="$(cat "$LAST_DEPLOYED_FILE")"

NEW_SHA="$(git rev-parse HEAD)"
NEW_SHA_SHORT="${NEW_SHA:0:12}"

if [[ -n "$PREV_SHA" && "$PREV_SHA" == "$NEW_SHA" ]]; then
  echo "[deploy] Already at $NEW_SHA_SHORT — nothing new to deploy."
fi

echo "[deploy] Building Docker image (petition-app:latest, petition-app:${NEW_SHA_SHORT})..."
# GIT_SHA busts the source COPY + build layers so a deploy can never silently
# ship a stale bundle from a cache-hit COPY layer (see Dockerfile). Tagging
# with the short SHA too (in addition to :latest) keeps the previous image
# available under docker-compose.prod.yml's ${IMAGE_TAG:-latest} for rollback.
docker build \
  --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY="${NEXT_PUBLIC_TURNSTILE_SITE_KEY}" \
  --build-arg GIT_SHA="${NEW_SHA}" \
  -t petition-app:latest \
  -t "petition-app:${NEW_SHA_SHORT}" \
  .

# Snapshot the DB before touching it. Best-effort — a backup failure shouldn't
# block a deploy that has no destructive migration in it, but it must never
# silently swallow a real error either, so we log loudly and continue.
echo "[deploy] Backing up database before migrating..."
bash scripts/backup-db.sh || echo "[deploy] WARNING: backup failed — continuing anyway (see log above)." >&2

echo "[deploy] Running Prisma migrations..."
docker compose -f docker-compose.prod.yml run --rm \
  -e DATABASE_URL="postgresql://${POSTGRES_USER:-petition}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-petition}" \
  app npx prisma migrate deploy

echo "[deploy] Restarting app container..."
docker compose -f docker-compose.prod.yml up -d --no-deps app

# ---------------------------------------------------------------------------
# Health check + automatic rollback
#
# Rolls back the APP CODE only — migrations already applied above are not
# reverted (this project has no down-migrations). Safe as long as schema
# changes stay additive/backward-compatible with the previous release, which
# is the existing convention here (nullable columns, new tables). A rollback
# after a genuinely breaking migration would need a manual DB restore from
# the backup taken above.
# ---------------------------------------------------------------------------
echo "[deploy] Health-checking the new container..."
HEALTH_OK=false
for i in $(seq 1 15); do
  # 0.0.0.0, not localhost — inside this container `localhost` resolves to
  # ::1 first with no IPv4 fallback, so wget gets connection refused even
  # though the app is listening fine on IPv4. Matches the existing crontab
  # health checks, which already use 0.0.0.0 for the same reason.
  if docker compose -f docker-compose.prod.yml exec -T app wget -q -O- http://0.0.0.0:3000/api/health >/dev/null 2>&1; then
    HEALTH_OK=true
    break
  fi
  sleep 2
done

if [[ "$HEALTH_OK" != true ]]; then
  echo "[deploy] ERROR: health check failed after restart." >&2
  if [[ -n "$PREV_SHA" ]]; then
    PREV_SHA_SHORT="${PREV_SHA:0:12}"
    echo "[deploy] Rolling back to ${PREV_SHA_SHORT}..." >&2
    if IMAGE_TAG="$PREV_SHA_SHORT" docker compose -f docker-compose.prod.yml up -d --no-deps app; then
      echo "[deploy] Rolled back to ${PREV_SHA_SHORT}. Investigate ${NEW_SHA_SHORT} before retrying." >&2
    else
      echo "[deploy] Rollback itself failed to start — manual intervention needed." >&2
    fi
  else
    echo "[deploy] No previous deploy recorded — nothing to roll back to. Manual intervention needed." >&2
  fi
  exit 1
fi

echo "[deploy] Health check passed."
echo "$NEW_SHA" > "$LAST_DEPLOYED_FILE"

# Reclaim build cache so it can't fill the disk. Each deploy builds a fresh
# image; the buildkit cache (in /var/lib/containerd) grows ~5GB/build and
# filled the 75GB disk after ~14 deploys, taking Postgres down (it couldn't
# write → rejected connections). `until=24h` keeps today's cache for fast
# rebuilds while pruning the backlog. Non-fatal — never block a deploy on it.
echo "[deploy] Pruning Docker build cache older than 24h..."
docker builder prune -f --filter until=24h || true

# Keep the last 5 SHA-tagged images (rollback history) so disk doesn't grow
# unbounded across months of deploys. :latest is excluded from this count.
echo "[deploy] Pruning old SHA-tagged images (keeping last 5)..."
docker images --format '{{.Repository}}:{{.Tag}}\t{{.CreatedAt}}' \
  | grep '^petition-app:' \
  | grep -v ':latest\s' \
  | sort -k2 -r \
  | tail -n +6 \
  | cut -f1 \
  | xargs -r docker rmi -f || true

echo "[deploy] Done."
if [[ -t 1 ]]; then
  echo "[deploy] Tailing logs (Ctrl-C to exit)..."
  docker compose -f docker-compose.prod.yml logs -f --tail=50 app
else
  # Non-interactive (CI) — never block on an infinite follow. Bounded snapshot instead.
  echo "[deploy] Non-interactive session — last 50 log lines (no follow):"
  docker compose -f docker-compose.prod.yml logs --tail=50 app
fi
