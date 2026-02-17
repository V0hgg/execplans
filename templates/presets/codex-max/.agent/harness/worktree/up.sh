#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

load_state

PID_FILE="$(pid_file)"
LOG_FILE="$(log_file)"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Worktree runtime already running (pid=$(cat "$PID_FILE"), app_port=$APP_PORT)."
  exit 0
fi

START_CMD="python3 -m http.server $APP_PORT --bind 127.0.0.1"
if [[ -x "$SCRIPT_DIR/app-start.sh" ]]; then
  START_CMD="$SCRIPT_DIR/app-start.sh"
fi

echo "Starting worktree runtime for id=$WORKTREE_ID on app_port=$APP_PORT"
nohup bash -lc "$START_CMD" >"$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "Runtime started."
echo "  state: $(state_file)"
echo "  pid:   $(cat "$PID_FILE")"
echo "  logs:  $LOG_FILE"
echo "  url:   http://127.0.0.1:$APP_PORT"
