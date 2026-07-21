#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/..";set -a;source .env;set +a;: "${DATABASE_URL:?DATABASE_URL is required}";for f in backend/migrations/*.sql;do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f";done

