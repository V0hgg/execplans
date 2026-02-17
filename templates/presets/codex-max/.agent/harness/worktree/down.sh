#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

load_state

PID_FILE="$(pid_file)"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No running runtime for worktree id=$WORKTREE_ID"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped runtime pid=$PID"
else
  echo "Runtime pid=$PID was already stopped"
fi

rm -f "$PID_FILE"
