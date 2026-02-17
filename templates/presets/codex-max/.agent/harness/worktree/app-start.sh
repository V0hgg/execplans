#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

load_state

# Replace this command with your repository-specific dev start command.
exec python3 -m http.server "$APP_PORT" --bind 127.0.0.1
