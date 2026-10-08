#!/bin/sh
# AC-0068: while `npm run dev` runs, once it logs that it reloaded .env.local after a
# check-name variable (POSTGRES_URL) was written there, GET /sign-in, GET /receiving,
# and POST /receiving each answer 500 with a body that does not contain the value.
# Run from the repository root with no privileged variable in the shell. It exits
# non-zero unless all three answers are 500 and the value appears in no body and
# not in the dev log.
set -u
ROOT="$(pwd)"
PORT=3101
BASE="http://127.0.0.1:$PORT"
WORK="$(mktemp -d)"
LOG="$WORK/dev.log"
MARKER="marker-$(date +%s)-ac0068"
ENVFILE="$ROOT/.env.local"
BACKUP="$WORK/env.local.backup"
HAD_ENV_LOCAL=0

if [ -e "$ENVFILE" ]; then
  HAD_ENV_LOCAL=1
  cp -p "$ENVFILE" "$BACKUP"
fi

cleanup() {
  if [ "$HAD_ENV_LOCAL" = 1 ]; then cp -p "$BACKUP" "$ENVFILE"; else rm -f "$ENVFILE"; fi
  if [ -n "${DEV_PID:-}" ]; then
    # Stop the whole process tree the npm script started.
    PIDS="$DEV_PID"
    NEXT="$DEV_PID"
    while [ -n "$NEXT" ]; do
      NEXT="$(for p in $NEXT; do pgrep -P "$p"; done | tr '\n' ' ')"
      PIDS="$PIDS $NEXT"
    done
    kill $PIDS 2>/dev/null
    sleep 1
    kill -9 $PIDS 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

npm run dev -- -p "$PORT" >"$LOG" 2>&1 &
DEV_PID=$!

# 1. The dev server answers GET /sign-in with 200.
i=0
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/sign-in")" = 200 ]; do
  i=$((i + 1))
  [ "$i" -gt 90 ] && { echo "FAIL: /sign-in never answered 200"; tail -20 "$LOG"; exit 1; }
  sleep 1
done
echo "before: GET /sign-in -> 200"

# 2. Write the check-name variable into .env.local and wait for the reload line.
printf 'POSTGRES_URL=%s\n' "$MARKER" >"$ENVFILE"
i=0
until grep -q "Reload env" "$LOG"; do
  i=$((i + 1))
  [ "$i" -gt 60 ] && { echo "FAIL: no 'Reload env' line"; tail -20 "$LOG"; exit 1; }
  sleep 1
done
echo "log: $(grep -m1 'Reload env' "$LOG")"

# 3. The next GET, GET, and POST each answer 500 without the value in the body.
FAILED=0
check() {
  label="$1"; shift
  code="$(curl -s -o "$WORK/body" -w '%{http_code}' "$@")"
  if grep -q "$MARKER" "$WORK/body"; then leak="MARKER IN BODY"; FAILED=1; else leak="no marker in body"; fi
  [ "$code" = 500 ] || FAILED=1
  echo "after:  $label -> $code ($leak), body: $(head -c 60 "$WORK/body")"
}
check "GET  /sign-in " "$BASE/sign-in"
check "GET  /receiving" "$BASE/receiving"
check "POST /receiving" -X POST -d 'x=1' "$BASE/receiving"

if grep -q "$MARKER" "$LOG"; then echo "dev log: MARKER IN LOG"; FAILED=1; else echo "dev log: no marker"; fi

if [ "$FAILED" = 0 ]; then echo "PASS"; else echo "FAIL"; fi
exit "$FAILED"
