#!/usr/bin/env bash
set -euo pipefail

RELEASE_ID="${1:-}"
if [[ -z "$RELEASE_ID" || ! "$RELEASE_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Usage: $0 <release-id>" >&2
  exit 1
fi

DEPLOY_ROOT="${MALIKSE_DEPLOY_ROOT:-/srv/malikse}"
INCOMING_DIR="$DEPLOY_ROOT/deploy/incoming"
ARCHIVE_PATH="$INCOMING_DIR/$RELEASE_ID.tar.gz"
RELEASES_DIR="$DEPLOY_ROOT/releases"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
SHARED_DIR="$DEPLOY_ROOT/shared"
CURRENT_LINK="$DEPLOY_ROOT/current"
APP_NAME="${PM2_APP_NAME:-malikse-api}"
PORT="${PORT:-5000}"

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Release archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi

mkdir -p "$RELEASES_DIR" "$SHARED_DIR/uploads"

if [[ ! -f "$SHARED_DIR/.env" ]]; then
  echo "Missing runtime config: $SHARED_DIR/.env" >&2
  echo "Create $SHARED_DIR/.env on Bluehost before deploying." >&2
  exit 1
fi

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_DIR"

if [[ ! -f "$RELEASE_DIR/server/package.json" ]]; then
  echo "Extracted archive does not contain server/package.json" >&2
  exit 1
fi

ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/server/.env"
rm -rf "$RELEASE_DIR/server/uploads"
ln -sfn "$SHARED_DIR/uploads" "$RELEASE_DIR/server/uploads"

cd "$RELEASE_DIR/server"
npm ci --include=dev --ignore-scripts
npm run build

if [[ ! -f "$RELEASE_DIR/server/dist/index.js" ]]; then
  echo "Build failed: dist/index.js missing" >&2
  exit 1
fi

ln -sfn "$RELEASE_DIR/server" "$CURRENT_LINK"

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start "$CURRENT_LINK/dist/index.js" --name "$APP_NAME" --cwd "$CURRENT_LINK" --update-env
fi
pm2 save >/dev/null 2>&1 || true

curl --fail --silent --show-error --retry 10 --retry-delay 2 --max-time 10 "http://127.0.0.1:${PORT}/ready" >/dev/null

rm -f "$ARCHIVE_PATH"

# Keep the 5 most recent releases on disk.
mapfile -t OLD_RELEASES < <(ls -1dt "$RELEASES_DIR"/* 2>/dev/null | tail -n +6 || true)
for old in "${OLD_RELEASES[@]}"; do
  rm -rf "$old"
done

echo "Deployed $APP_NAME release $RELEASE_ID successfully."
