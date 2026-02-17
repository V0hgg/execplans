#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
E2E_DIR="$ROOT_DIR/test/e2e"
TEMPLATE_DIR="$E2E_DIR/dummy-app-template"
RUN_ROOT="${RUN_ROOT:-$E2E_DIR/.tmp/full-functional-$(date +%Y%m%d-%H%M%S)}"
KEEP_RUN_ROOT="${KEEP_RUN_ROOT:-false}"
INSTALL_MODE="${INSTALL_MODE:-local}" # local | npm

PACKAGE_NAME="${PACKAGE_NAME:-$(node -p "require('$ROOT_DIR/package.json').name")}"
PACKAGE_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
TARGET_REPO="$RUN_ROOT/dummy-app"
STACK_UP=false

log() {
  printf '[e2e] %s\n' "$1"
}

fail() {
  printf '[e2e] ERROR: %s\n' "$1" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

cleanup() {
  if [[ "$STACK_UP" == "true" ]]; then
    docker compose -f "$TARGET_REPO/.agent/harness/observability/docker-compose.yml" down -v >/dev/null 2>&1 || true
  fi

  if [[ "$KEEP_RUN_ROOT" != "true" ]]; then
    rm -rf "$RUN_ROOT"
  else
    log "Keeping run directory: $RUN_ROOT"
  fi
}
trap cleanup EXIT

wait_http() {
  local name="$1"
  local url="$2"
  local attempts=0
  until curl -fsS "$url" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge 60 ]]; then
      fail "$name did not become ready at $url"
    fi
    sleep 1
  done
}

verify_vector_started() {
  local logs
  logs="$(docker logs codex-observability-vector 2>&1 || true)"
  if ! printf '%s' "$logs" | grep -q 'Vector has started'; then
    fail "Vector did not report startup in container logs"
  fi
}

install_local_package() {
  local source_copy="$RUN_ROOT/package-source"
  local package_tgz

  log "Preparing isolated package source copy"
  mkdir -p "$source_copy"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude '.git' \
      --exclude 'node_modules' \
      --exclude 'test/e2e/.tmp' \
      "$ROOT_DIR/" "$source_copy/"
  else
    cp -R "$ROOT_DIR/." "$source_copy/"
    rm -rf "$source_copy/.git" "$source_copy/node_modules" "$source_copy/test/e2e/.tmp"
  fi

  npm -C "$source_copy" ci >/dev/null
  npm -C "$source_copy" pack --pack-destination "$RUN_ROOT" >/dev/null

  package_tgz="$(ls -1t "$RUN_ROOT"/"$PACKAGE_NAME"-*.tgz | head -n1)"
  [[ -f "$package_tgz" ]] || fail "Could not produce package tarball for $PACKAGE_NAME"

  log "Installing from local tarball: $(basename "$package_tgz")"
  npm -C "$TARGET_REPO" install --save-dev "$package_tgz" >/dev/null
}

install_npm_package() {
  log "Installing from npm registry: ${PACKAGE_NAME}@latest"
  npm -C "$TARGET_REPO" install --save-dev "${PACKAGE_NAME}@latest" >/dev/null
}

verify_docs_structure() {
  local required_files=(
    "AGENTS.md"
    "ARCHITECTURE.md"
    "docs/design-docs/index.md"
    "docs/design-docs/core-beliefs.md"
    "docs/exec-plans/active/.gitkeep"
    "docs/exec-plans/completed/.gitkeep"
    "docs/exec-plans/tech-debt-tracker.md"
    "docs/generated/db-schema.md"
    "docs/product-specs/index.md"
    "docs/product-specs/new-user-onboarding.md"
    "docs/references/design-system-reference-llms.txt"
    "docs/references/nixpacks-llms.txt"
    "docs/references/uv-llms.txt"
    "docs/DESIGN.md"
    "docs/FRONTEND.md"
    "docs/PLANS.md"
    "docs/PRODUCT_SENSE.md"
    "docs/QUALITY_SCORE.md"
    "docs/RELIABILITY.md"
    "docs/SECURITY.md"
  )

  for relative_path in "${required_files[@]}"; do
    [[ -f "$TARGET_REPO/$relative_path" ]] || fail "Missing expected scaffold file: $relative_path"
  done

  grep -q '\[mcp_servers.chrome_devtools\]' "$TARGET_REPO/.codex/config.toml" || fail "Missing chrome_devtools MCP block"
  grep -q '\[mcp_servers.observability\]' "$TARGET_REPO/.codex/config.toml" || fail "Missing observability MCP block"
}

main() {
  need_cmd git
  need_cmd node
  need_cmd npm
  need_cmd npx
  need_cmd python3
  need_cmd curl
  need_cmd docker

  docker info >/dev/null 2>&1 || fail "Docker daemon is not available"

  [[ -d "$TEMPLATE_DIR" ]] || fail "Missing fixture template directory: $TEMPLATE_DIR"

  rm -rf "$RUN_ROOT"
  mkdir -p "$RUN_ROOT"
  cp -R "$TEMPLATE_DIR" "$TARGET_REPO"

  log "Run directory: $RUN_ROOT"
  log "Target repo: $TARGET_REPO"
  log "Testing package: $PACKAGE_NAME@$PACKAGE_VERSION (mode=$INSTALL_MODE)"

  git -C "$TARGET_REPO" init >/dev/null

  if [[ "$INSTALL_MODE" == "local" ]]; then
    install_local_package
  elif [[ "$INSTALL_MODE" == "npm" ]]; then
    install_npm_package
  else
    fail "Unsupported INSTALL_MODE=$INSTALL_MODE (expected local or npm)"
  fi

  log "Running init + doctor"
  npx --yes --prefix "$TARGET_REPO" "$PACKAGE_NAME" init --root "$TARGET_REPO" --preset codex-max
  npx --yes --prefix "$TARGET_REPO" "$PACKAGE_NAME" doctor --root "$TARGET_REPO" --preset codex-max

  log "Validating generated docs and MCP config"
  verify_docs_structure

  log "Validating worktree runtime scripts"
  bash "$TARGET_REPO/.agent/harness/worktree/up.sh" >/dev/null
  app_port="$(bash "$TARGET_REPO/.agent/harness/worktree/status.sh" | awk -F= '/^app_port=/{print $2}')"
  [[ -n "$app_port" ]] || fail "Unable to parse app_port from worktree status output"
  wait_http "dummy app" "http://127.0.0.1:$app_port"
  bash "$TARGET_REPO/.agent/harness/worktree/down.sh" >/dev/null

  log "Starting observability stack"
  docker compose -f "$TARGET_REPO/.agent/harness/observability/docker-compose.yml" up -d >/dev/null
  STACK_UP=true

  wait_http "victoria-logs" "http://127.0.0.1:9428/health"
  wait_http "victoria-metrics" "http://127.0.0.1:8428/health"
  wait_http "victoria-traces" "http://127.0.0.1:10428/health"
  wait_http "vector api" "http://127.0.0.1:8686/health"

  log "Checking Vector service startup and API health"
  verify_vector_started

  log "Running generated observability smoke script"
  bash "$TARGET_REPO/.agent/harness/observability/smoke.sh"

  log "Checking MCP observability tools"
  node "$E2E_DIR/mcp-observability-check.mjs" "$TARGET_REPO"

  docker compose -f "$TARGET_REPO/.agent/harness/observability/docker-compose.yml" down -v >/dev/null
  STACK_UP=false

  log "PASS: full functional verification complete"
}

main "$@"
