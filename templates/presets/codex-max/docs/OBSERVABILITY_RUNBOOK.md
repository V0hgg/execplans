# Observability Runbook

Use this runbook to verify that docs, Docker services, and MCP observability tools are working in a fresh repository.

## Scope

This runbook validates:

- required docs scaffold exists and is editable
- local observability stack (Vector + Victoria Logs/Metrics/Traces) starts
- MCP server tools (`query_logs`, `query_metrics`, `query_traces`) return usable results

## Quick Commands

Run from repository root:

```bash
codex-promax init
codex-promax doctor
docker compose -f .agent/harness/observability/docker-compose.yml up -d
bash .agent/harness/observability/smoke.sh
docker compose -f .agent/harness/observability/docker-compose.yml down -v
```

## Docs Health Checks

Run these checks before and after updates:

```bash
test -f docs/OBSERVABILITY_RUNBOOK.md
test -f docs/generated/observability-validation.md
rg -n "Replace this placeholder|Describe " docs || true
```

If `rg` prints placeholder lines, replace them with project-specific content.

## Codex Prompt (Natural Language, Copy/Paste)

Use this prompt with your coding assistant inside the target repository:

```text
I just installed codex-promax in this repository. It should have created the docs structure, the Docker observability stack (Vector + Victoria Logs/Metrics/Traces), and MCP integrations for chrome_devtools plus observability tools (query_logs, query_metrics, query_traces).

Please verify end-to-end that everything is actually ready for Codex coding work, not just present on disk. Run codex-promax doctor, confirm docs structure and identify any placeholder docs that still need real project content, start the observability Docker stack, run the smoke checks, and validate the three MCP observability tools with real queries (smoke-log-line, process_cpu_cores_available, smoke-service).

If anything fails, apply the smallest safe fix and re-test until all checks pass or a clear blocker is found. Write the full evidence (commands run, key outputs, MCP results, fixes, and final readiness status) to docs/generated/observability-validation.md, then stop the Docker stack and return a short PASS/FAIL summary with remaining risks.
```

## Definition Of Pass

- `codex-promax doctor` prints `OK`
- `smoke.sh` prints PASS for logs, metrics, traces
- all three MCP tools return successful responses with expected signal
- `docs/generated/observability-validation.md` is updated with the current run details
