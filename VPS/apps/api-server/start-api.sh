#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$SCRIPT_DIR"
exec "$RUNTIME_ROOT/node_modules/.bin/tsx" src/main.ts
