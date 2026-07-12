#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${JENIX_ONE_ENV_FILE:-/root/secrets/iot-one/api-server.env}"

cd "$SCRIPT_DIR"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
exec "$SCRIPT_DIR/node_modules/.bin/tsx" src/main.ts
