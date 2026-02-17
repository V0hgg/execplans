# E2E Full Functional Test

This folder contains an isolated end-to-end harness that verifies the full codex-max pipeline in a throwaway repo.

What it verifies:

- package install (`local` tarball build or `npm` latest)
- `init --preset codex-max` and `doctor --preset codex-max`
- generated docs topology and MCP config blocks
- worktree runtime scripts (`up`/`status`/`down`)
- observability stack startup (Vector + Victoria Logs/Metrics/Traces)
- Vector fan-out signal checks
- generated smoke script checks for logs, metrics, traces
- MCP server tool calls for `query_logs`, `query_metrics`, `query_traces`

Run from repository root:

```bash
npm run test:e2e
```

Run against published npm package instead of local source:

```bash
npm run test:e2e:npm
```

Useful environment overrides:

- `KEEP_RUN_ROOT=true` keeps the temporary run directory for inspection.
- `RUN_ROOT=/absolute/path` sets a specific run location.
- `INSTALL_MODE=local|npm` controls install source.
