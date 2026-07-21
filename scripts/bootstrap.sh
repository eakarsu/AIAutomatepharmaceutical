#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/..";test -f .env||{ cp .env.example .env;echo 'Created .env; replace secrets.';exit 1;};npm --prefix backend ci;npm --prefix frontend ci

