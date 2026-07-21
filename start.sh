#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")";test -f .env||{ echo 'Copy .env.example to .env.';exit 1;};test -d backend/node_modules -a -d frontend/node_modules||{ echo 'Run scripts/bootstrap.sh first.';exit 1;};set -a;source .env;set +a;node backend/src/server.js& backend_pid=$!;npm --prefix frontend start& frontend_pid=$!;cleanup(){ kill "$backend_pid" "$frontend_pid" 2>/dev/null||true;};trap cleanup EXIT INT TERM;wait "$backend_pid" "$frontend_pid"
