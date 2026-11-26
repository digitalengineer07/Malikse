#!/usr/bin/env bash
# Isolated control-flow tests: no real SSH, PM2, npm installation, or HTTP calls.
set -euo pipefail
source_script="$(cd "$(dirname "$0")" && pwd)/bluehost.sh"
test_root=$(mktemp -d)
mkdir -p "$test_root/bin"
export PATH="$test_root/bin:$PATH"

cat > "$test_root/bin/id" <<'EOF'
#!/usr/bin/env bash
if [[ "$SCENARIO" == root-rejected ]]; then echo root; else echo malikse-deploy; fi
EOF
cat > "$test_root/bin/npm" <<'EOF'
#!/usr/bin/env bash
[[ "$SCENARIO" != build-failure ]] || exit 1
mkdir -p dist
echo '// mock build' > dist/index.js
EOF
cat > "$test_root/bin/pm2" <<'EOF'
#!/usr/bin/env bash
[[ "$PM2_HOME" == /home/malikse-deploy/.pm2 ]] || exit 99
echo "$*" >> "$CASE_DIR/pm2.log"
case "$1" in
  jlist) printf '[{"name":"malikse-api","pm2_env":{"pm_exec_path":"/old/dist/index.js","pm_cwd":"/old","exec_interpreter":"node","env":{}}}]' ;;
  delete) echo stopped > "$CASE_DIR/state" ;;
  start)
    if [[ "$2" == *rollback.json ]]; then echo old > "$CASE_DIR/state";
    else echo new > "$CASE_DIR/state"; fi ;;
esac
EOF
cat > "$test_root/bin/curl" <<'EOF'
#!/usr/bin/env bash
if [[ "$SCENARIO" == unhealthy && "$(cat "$CASE_DIR/state")" == new ]]; then exit 22; fi
EOF
for command in flock sleep; do
  printf '#!/usr/bin/env bash\nexit 0\n' > "$test_root/bin/$command"
done
chmod +x "$test_root/bin/"*

for SCENARIO in success build-failure unhealthy root-rejected; do
  export SCENARIO
  CASE_DIR="$test_root/$SCENARIO"
  export CASE_DIR
  mkdir -p "$CASE_DIR/base/incoming" "$CASE_DIR/shared/uploads" "$CASE_DIR/source/server"
  echo 'PORT=5000' > "$CASE_DIR/shared/.env"
  echo original > "$CASE_DIR/shared/uploads/keep.txt"
  echo old > "$CASE_DIR/state"
  echo '{}' > "$CASE_DIR/source/server/package.json"
  release_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-1-1
  tar -czf "$CASE_DIR/base/incoming/$release_id.tar.gz" -C "$CASE_DIR/source" server
  sed -e "s|^base=/srv/malikse/deploy$|base=$CASE_DIR/base|" \
      -e "s|^shared=/srv/malikse/server$|shared=$CASE_DIR/shared|" \
      "$source_script" > "$CASE_DIR/deploy.sh"
  status=0
  bash "$CASE_DIR/deploy.sh" "$release_id" > "$CASE_DIR/output.log" 2>&1 || status=$?
  case "$SCENARIO" in
    success)
      test "$status" = 0
      test "$(cat "$CASE_DIR/state")" = new
      test -f "$CASE_DIR/base/current-release"
      grep -q '^save$' "$CASE_DIR/pm2.log"
      ;;
    build-failure|root-rejected)
      test "$status" != 0
      test "$(cat "$CASE_DIR/state")" = old
      test ! -f "$CASE_DIR/pm2.log"
      ;;
    unhealthy)
      test "$status" != 0
      test "$(cat "$CASE_DIR/state")" = old
      grep -q 'Previous API restored' "$CASE_DIR/output.log"
      test ! -f "$CASE_DIR/base/current-release"
      ;;
  esac
  test "$(cat "$CASE_DIR/shared/uploads/keep.txt")" = original
  test "$(cat "$CASE_DIR/shared/.env")" = PORT=5000
  echo "PASS: $SCENARIO"
done
echo "Test artifacts: $test_root"
