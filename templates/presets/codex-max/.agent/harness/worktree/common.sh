#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd -P)"
STATE_DIR="$ROOT_DIR/.agent/harness/state"

mkdir -p "$STATE_DIR"

compute_worktree_hash() {
  local worktree_path
  worktree_path="$ROOT_DIR"
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$worktree_path" | shasum -a 256 | awk '{print $1}'
    return 0
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$worktree_path" | sha256sum | awk '{print $1}'
    return 0
  fi

  python3 - <<'PY'
import hashlib
import os
print(hashlib.sha256(os.getcwd().encode("utf-8")).hexdigest())
PY
}

worktree_id() {
  compute_worktree_hash | cut -c1-12
}

state_file() {
  printf '%s/%s.env\n' "$STATE_DIR" "$(worktree_id)"
}

pid_file() {
  printf '%s/%s.pid\n' "$STATE_DIR" "$(worktree_id)"
}

log_file() {
  printf '%s/%s.log\n' "$STATE_DIR" "$(worktree_id)"
}

port_offset() {
  python3 - "$1" <<'PY'
import sys
print(int(sys.argv[1], 16) % 1000)
PY
}

ensure_state_file() {
  local state
  state="$(state_file)"
  if [[ -f "$state" ]]; then
    return 0
  fi

  local hash id offset app_port chrome_port
  hash="$(compute_worktree_hash)"
  id="$(worktree_id)"
  offset="$(port_offset "$id")"
  app_port=$((4100 + offset))
  chrome_port=$((9100 + offset))

  cat > "$state" <<STATE
WORKTREE_ID=$id
WORKTREE_HASH=$hash
APP_PORT=$app_port
CHROME_MCP_PORT=$chrome_port
ROOT_DIR=$ROOT_DIR
STATE
}

load_state() {
  ensure_state_file
  # shellcheck disable=SC1090
  source "$(state_file)"
}
