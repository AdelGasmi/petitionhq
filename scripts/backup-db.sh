#!/usr/bin/env bash
# backup-db.sh — Daily Postgres → Cloudflare R2 backup
# Runs pg_dump inside Docker, compresses, uploads via AWS CLI
#
# Prerequisites on server:
#   apt install -y awscli
#   Configure ~/.aws/credentials (or set env vars below)
#
# Crontab (run daily at 3 AM server time):
#   0 3 * * * cd /opt/petitionhq && bash scripts/backup-db.sh >> /var/log/petitionhq-backup.log 2>&1

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
COMPOSE_FILE="/opt/petitionhq/docker-compose.prod.yml"
BACKUP_DIR="/tmp/petition-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="petition_db_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"
R2_BUCKET="petitionhq-secure-data"
R2_PREFIX="backups"
KEEP_DAYS=30   # delete remote backups older than this

# Load R2 credentials from app .env
ENV_FILE="/opt/petitionhq/.env"
if [[ -f "$ENV_FILE" ]]; then
  export AWS_ACCESS_KEY_ID=$(grep ^R2_ACCESS_KEY_ID "$ENV_FILE" | cut -d= -f2-)
  export AWS_SECRET_ACCESS_KEY=$(grep ^R2_SECRET_ACCESS_KEY "$ENV_FILE" | cut -d= -f2-)
  R2_ENDPOINT=$(grep ^R2_ENDPOINT "$ENV_FILE" | cut -d= -f2-)
fi

# ── Dump ──────────────────────────────────────────────────────────────────────
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup → ${FILENAME}"

mkdir -p "$BACKUP_DIR"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U petition petition \
  | gzip -9 > "$BACKUP_PATH"

SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Dump complete — ${SIZE}"

# ── Upload to R2 ──────────────────────────────────────────────────────────────
aws s3 cp "$BACKUP_PATH" \
  "s3://${R2_BUCKET}/${R2_PREFIX}/${FILENAME}" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Uploaded to R2: ${R2_PREFIX}/${FILENAME}"

# ── Prune old remote backups ──────────────────────────────────────────────────
CUTOFF=$(date -d "-${KEEP_DAYS} days" +%Y%m%d 2>/dev/null \
  || date -v "-${KEEP_DAYS}d" +%Y%m%d)   # macOS fallback

aws s3 ls "s3://${R2_BUCKET}/${R2_PREFIX}/" \
  --endpoint-url "$R2_ENDPOINT" \
  | awk '{print $4}' \
  | while read KEY; do
      FILE_DATE=$(echo "$KEY" | grep -oP '\d{8}' | head -1)
      if [[ -n "$FILE_DATE" && "$FILE_DATE" < "$CUTOFF" ]]; then
        echo "  Deleting old backup: ${KEY}"
        aws s3 rm "s3://${R2_BUCKET}/${R2_PREFIX}/${KEY}" \
          --endpoint-url "$R2_ENDPOINT"
      fi
    done

# ── Cleanup local temp ────────────────────────────────────────────────────────
rm -f "$BACKUP_PATH"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete ✓"
