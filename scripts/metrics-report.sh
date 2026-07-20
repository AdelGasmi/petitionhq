#!/usr/bin/env bash
# Weekly ops + funnel snapshot for petitionhq.us. Read-only; run from your laptop:
#   bash scripts/metrics-report.sh
# Covers: app health, disk (the buildkit-cache failure mode), cron install,
# 7-day funnel events, lead totals, pitch inventory, email failures.
set -uo pipefail

HOST="root@YOUR_SERVER_IP"
PSQL='cd /opt/petitionhq && docker compose -f docker-compose.prod.yml exec -T postgres psql -U petition -d petition -P pager=off'

echo "== app health =="
curl -sf --max-time 10 https://petitionhq.us/api/health && echo || echo "!! HEALTH CHECK FAILED"

echo
echo "== disk (watch for buildkit cache — fix: docker builder prune -af) =="
ssh "$HOST" 'df -h / | tail -1; echo; docker system df'

echo
echo "== crons installed (expect 5) =="
ssh "$HOST" 'crontab -l 2>/dev/null | grep -c "api/cron" || echo 0'

echo
echo "== funnel + leads (last 7 days) =="
ssh "$HOST" "$PSQL" <<'SQL'
SELECT event, count(*) FROM "FunnelEvent"
WHERE "createdAt" >= now() - interval '7 days'
GROUP BY 1 ORDER BY 2 DESC;

SELECT count(*) AS new_leads_7d FROM "Lead"
WHERE "capturedAt" >= now() - interval '7 days';

SELECT count(*)                                                        AS total_leads,
       count(*) FILTER (WHERE maturity = 'M7')                         AS m7,
       count(*) FILTER (WHERE "applicantStatus" = 'approved')          AS consented,
       count(*) FILTER (WHERE maturity = 'M7'
                          AND "applicantStatus" = 'approved'
                          AND "claimedByUserId" IS NULL)               AS pitch_inventory
FROM "Lead";

SELECT status, count(*) FROM "EmailLog"
WHERE "createdAt" >= now() - interval '7 days'
GROUP BY 1;

SELECT count(*) AS claim_payments_total FROM "LeadClaimPayment";
SQL
