# execplans

Scaffold and validate ExecPlan workflows for AI coding assistants.

## Development

```bash
npm install
npm run ci
```

## CLI

```bash
npx -y execplans@latest init
```

Or after global install:

```bash
npm i -g execplans
execplans init
```

## Codex-max preset

Use the `codex-max` preset to scaffold the expanded docs structure and Codex harness files:

```bash
execplans init --preset codex-max
```

After scaffold, boot the worktree-local runtime used by UI legibility workflows:

```bash
.agent/harness/worktree/up.sh
.agent/harness/worktree/status.sh
# when finished
.agent/harness/worktree/down.sh
```

Validate codex-max scaffold health:

```bash
execplans doctor --preset codex-max
```

Run local observability smoke checks (requires Docker daemon access):

```bash
docker compose -f .agent/harness/observability/docker-compose.yml up -d
bash .agent/harness/observability/smoke.sh
docker compose -f .agent/harness/observability/docker-compose.yml down -v
```

## Release workflow

- CI runs on pull requests and pushes to `main` via `.github/workflows/ci.yml`.
- To cut a release, run the `release` workflow manually and select `patch`, `minor`, or `major`.
- The `release` workflow now bumps version, updates changelog, pushes commit+tag, and publishes to npm in the same run.
- Publishing requires `NPM_TOKEN` repository secret.

Local release helpers:

```bash
npm run release:patch
# or npm run release:minor / npm run release:major
```
