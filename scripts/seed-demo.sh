#!/usr/bin/env bash
set -euo pipefail
test "${CONFIRM_DEMO_SEED:-}" = yes||{ echo 'Set CONFIRM_DEMO_SEED=yes for synthetic data.';exit 2;};cd "$(dirname "$0")/../backend";node src/seeds/seed.js

