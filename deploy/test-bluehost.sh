#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_FILE="${1:-backend.tar.gz}"

if [[ ! -f deploy/bluehost.sh ]]; then
  echo "Missing deploy/bluehost.sh" >&2
  exit 1
fi

if [[ ! -f "$ARCHIVE_FILE" ]]; then
  echo "Missing package archive: $ARCHIVE_FILE" >&2
  exit 1
fi

bash -n deploy/bluehost.sh

ARCHIVE_LIST="$(tar -tzf "$ARCHIVE_FILE")"

for required in \
  "server/package.json" \
  "server/package-lock.json" \
  "server/tsconfig.json" \
  "server/server.js" \
  "server/src/index.ts"
do
  if ! grep -qx "$required" <<<"$ARCHIVE_LIST"; then
    echo "Missing required file in $ARCHIVE_FILE: $required" >&2
    exit 1
  fi
done

if grep -qE '(^|/)(\.env|\.env\.local)$' <<<"$ARCHIVE_LIST"; then
  echo "Refusing package containing .env file" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

tar -xzf "$ARCHIVE_FILE" -C "$TMP_DIR"
test -s "$TMP_DIR/server/package.json"
test -s "$TMP_DIR/server/src/index.ts"

echo "Verified $ARCHIVE_FILE and deploy/bluehost.sh cleanly."
