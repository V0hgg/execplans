# Observability Validation Report

Update this file after each full harness validation run.

## Run Metadata

- Date:
- Operator:
- Branch:
- Commit:
- Environment:

## Commands Executed

```bash
codex-promax doctor
docker compose -f .agent/harness/observability/docker-compose.yml up -d
bash .agent/harness/observability/smoke.sh
docker compose -f .agent/harness/observability/docker-compose.yml down -v
```

## Results

- Ready for Codex coding work: YES/NO
- Doctor status: PASS/FAIL
- Smoke logs: PASS/FAIL
- Smoke metrics: PASS/FAIL
- Smoke traces: PASS/FAIL
- MCP `query_logs`: PASS/FAIL
- MCP `query_metrics`: PASS/FAIL
- MCP `query_traces`: PASS/FAIL

## Evidence

- Key output excerpts:
- MCP response summary:
- Follow-up actions:
