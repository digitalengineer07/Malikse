#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Refuse accidental root execution; use only this account's PM2 daemon.
[[ "$(id -un)" == malikse-deploy ]] || { echo 'Run deployment as malikse-deploy, never root'; exit 1; }
export PM2_HOME=/home/malikse-deploy/.pm2

release_id=${1:?Release ID required}
[[ "$release_id" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || exit 2
base=/srv/malikse/deploy
shared=/srv/malikse/server
release="$base/releases/$release_id"
archive="$base/incoming/$release_id.tar.gz"
mkdir -p "$base/releases"
exec 9>"$base/deploy.lock"
flock -w 600 9

test -s "$shared/.env" || { echo 'Existing server .env is missing'; exit 1; }
test -s "$archive"
command -v pm2 >/dev/null
command -v curl >/dev/null
test ! -e "$release" || { echo 'Release directory already exists'; exit 1; }
mkdir "$release"
tar -xzf "$archive" --strip-components=1 -C "$release"
test ! -e "$release/.env" || { echo 'Do not commit a server .env'; exit 1; }
test ! -e "$release/uploads" || { echo 'Do not commit server uploads'; exit 1; }

# Build before exposing the production environment or stopping the current API.
cd "$release"
npm ci --include=dev
test -s dist/index.js
mkdir -p "$shared/uploads"
ln -s "$shared/.env" .env
ln -s "$shared/uploads" uploads

# Capture only the existing API, including its environment, for local rollback.
# This file may contain secrets and stays on the VPS with mode 600.
pm2 jlist | node -e '
const fs = require("fs");
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const p = JSON.parse(input).find(p => p.name === "malikse-api");
  if (!p) throw new Error("Existing malikse-api PM2 process is required");
  const e = p.pm2_env;
  fs.writeFileSync(process.argv[1], JSON.stringify({apps: [{
    name: "malikse-api", script: e.pm_exec_path, cwd: e.pm_cwd,
    interpreter: e.exec_interpreter, args: e.args,
    env: e.env || {}, exec_mode: "fork", instances: 1
  }]}), {mode: 0o600});
});' "$release/rollback.json"

ready() {
  for attempt in $(seq 1 45); do
    if curl --fail --silent --max-time 3 http://127.0.0.1:5000/ready >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback() {
  trap - ERR
  echo 'Deployment failed; restoring the previous PM2 process.'
  pm2 delete malikse-api || true
  if pm2 start "$release/rollback.json" --only malikse-api && ready; then
    pm2 save
    echo 'Previous API restored.'
  else
    echo 'Rollback requires attention; inspect PM2 logs on the VPS.'
  fi
  exit 1
}

# PM2 must switch script and cwd together; a normal restart keeps the old path.
trap rollback ERR
pm2 delete malikse-api
pm2 start "$release/dist/index.js" --name malikse-api --cwd "$release" --time
ready
pm2 save
trap - ERR
printf '%s\n' "$release" > "$base/current-release"
echo "Deployed $release_id successfully."
