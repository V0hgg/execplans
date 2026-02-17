#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

load_state

PID_FILE="$(pid_file)"
LOG_FILE="$(log_file)"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "status=running"
  echo "worktree_id=$WORKTREE_ID"
  echo "pid=$(cat "$PID_FILE")"
  echo "app_port=$APP_PORT"
  echo "chrome_mcp_port=$CHROME_MCP_PORT"
  echo "logs=$LOG_FILE"
  exit 0
fi

echo "status=stopped"
echo "worktree_id=$WORKTREE_ID"
echo "app_port=$APP_PORT"
echo "chrome_mcp_port=$CHROME_MCP_PORT"
echo "logs=$LOG_FILE"
