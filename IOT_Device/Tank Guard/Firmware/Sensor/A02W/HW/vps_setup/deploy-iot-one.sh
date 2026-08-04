#!/usr/bin/env bash
set -euo pipefail

PLATFORM_REPO_URL="https://github.com/manoj020218/iot-one.git"
PLATFORM_REPO_DIR="/root/repos/iot-one"
RUNTIME_DIR="/root/projects/IOT_one"
DEVICE_SYNC_SCRIPT="/root/bin/sync-device-registry.sh"
BRANCH="main"
SKIP_INSTALL="0"

for arg in "$@"; do
  case "$arg" in
    --skip-install)
      SKIP_INSTALL="1"
      ;;
    --branch=*)
      BRANCH="${arg#*=}"
      ;;
    *)
      BRANCH="$arg"
      ;;
  esac
done

if [ ! -d "$PLATFORM_REPO_DIR/.git" ]; then
  mkdir -p /root/repos
  git clone "$PLATFORM_REPO_URL" "$PLATFORM_REPO_DIR"
fi

git -C "$PLATFORM_REPO_DIR" fetch --prune origin
git -C "$PLATFORM_REPO_DIR" checkout "$BRANCH"
git -C "$PLATFORM_REPO_DIR" reset --hard "origin/$BRANCH"

mkdir -p "$RUNTIME_DIR" "$RUNTIME_DIR/device-registry"
rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.env' \
  --exclude 'device-registry/' \
  --exclude 'jenix-one-deploy.tgz' \
  "$PLATFORM_REPO_DIR/" "$RUNTIME_DIR/"

cd "$RUNTIME_DIR"

if [ "$SKIP_INSTALL" != "1" ]; then
  pnpm install --frozen-lockfile
fi

# @jenix/shared, @jenix/device-schemas, and @jenix/ui ship compiled dist/
# output that is gitignored, so it never exists after a fresh rsync — without
# this, jenix-one-api (which imports @jenix/shared's compiled dist/index.js
# directly via tsx) crash-loops with ERR_MODULE_NOT_FOUND.
pnpm -r --if-present build

"$DEVICE_SYNC_SCRIPT" "$BRANCH"

pm2 restart jenix-one-api
sleep 3
curl -sf http://127.0.0.1:4300/api/v1/health >/dev/null \
  && echo "jenix-one-api healthy" \
  || { echo "jenix-one-api failed its post-deploy health check" >&2; exit 1; }

echo "deploy complete: $BRANCH"
