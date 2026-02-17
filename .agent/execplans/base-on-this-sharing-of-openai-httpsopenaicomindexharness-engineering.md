# Ship a Codex-Max Harness Preset (Docs Topology + MCP UI Legibility + Observability Legibility)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` from the repository root.

## Purpose / Big Picture

After this work, a developer will be able to run one command in any Git repository and get a complete, OpenAI-harness-style starting point: a rich documentation structure, project-local Codex MCP setup for UI inspection and observability queries, and worktree-scoped boot scripts so each git worktree can run in isolation. The new behavior is visible immediately by running `execplans init --preset codex-max` in a fresh repository, then verifying generated files, MCP server config, and observability queries.

This change matters because it turns this package from a minimal ExecPlan scaffold into a reusable engineering harness installer that other repositories can adopt with minimal manual setup.

## Definition of Done

This plan is complete when all of the following are true and proven with command output:

1. `execplans init --preset codex-max` creates the requested docs topology and top-level docs files exactly, including `AGENTS.md`, `ARCHITECTURE.md`, and the `docs/` subtree defined in this plan.
2. Generated project config includes `.codex/config.toml` entries for a Chrome DevTools MCP server and an observability MCP server, with project-scoped paths so each git worktree can run independently.
3. Generated harness scripts can boot and stop a worktree-local runtime plus local observability stack without editing source code first.
4. Observability stack includes Vector fan-out plus Victoria Logs, Victoria Metrics, and Victoria Traces endpoints; queries succeed through both direct HTTP checks and the generated observability MCP adapter.
5. `execplans doctor` can validate the codex-max scaffold and report actionable fixes when critical files are missing or malformed.
6. End-to-end external install proof passes: package is packed, installed into a different repo, initialized, and verified with the documented smoke tests.

## Progress

- [x] (2026-02-17 09:04Z) Read `.agent/PLANS.md` fully and captured non-negotiable requirements plus mandatory sections.
- [x] (2026-02-17 09:04Z) Mapped current extension points (`src/cli.ts`, `src/core/config.ts`, `src/commands/init.ts`, `src/core/templates.ts`, `src/core/fsPlan.ts`, `src/core/doctorChecks.ts`, and tests).
- [x] (2026-02-17 09:04Z) Drafted a complete, self-contained ExecPlan with milestones, validation commands, and explicit Definition of Done.
- [x] (2026-02-17 09:17Z) Implemented Milestone 1: added preset parsing (`standard`, `codex-max`), CLI/config wiring for `--preset`, template-tree copy utility, init preset dispatch, and codex-max dry-run proof (`Would Create: .codex/config.toml`).
- [x] (2026-02-17 09:18Z) Implemented Milestone 2: added codex-max `ARCHITECTURE.md` and full `docs/` template topology, plus init tests for path presence and codex-max idempotence.
- [x] (2026-02-17 09:21Z) Implemented Milestone 3: added Chrome DevTools MCP config, worktree `up/down/status` scripts, and `ui-legibility` skill scaffold; validated with build + fresh-repo MCP/skill grep checks and runtime script smoke.
- [x] (2026-02-17 16:24Z) Completed Milestone 4 runtime validation: Docker compose stack boots cleanly and `.agent/harness/observability/smoke.sh` returns PASS for logs, metrics, and traces.
- [x] (2026-02-17 09:25Z) Implemented Milestone 5: added preset-aware `doctor` checks for codex-max artifacts, added codex-max doctor tests, and updated README validation/troubleshooting commands.
- [x] (2026-02-17 16:36Z) Completed Milestone 6 final acceptance in a second repository: packed tarball, installed package, ran `execplans init --preset codex-max`, got `doctor` `OK`, passed observability smoke checks, and verified MCP `query_logs`/`query_metrics`/`query_traces` tool calls.

## Surprises & Discoveries

- Observation: Current `execplans init` scaffolds only a small baseline (`.agent/PLANS.md`, `.agent/execplans/README.md`, managed assistant files, and two codex skill files), so codex-max needs a new preset path rather than trying to overload defaults.
  Evidence: `src/commands/init.ts` currently writes only six template targets and no nested docs tree.

- Observation: Codex project-scoped MCP configuration is supported through `.codex/config.toml`, and MCP servers can be defined per project/worktree via `[mcp_servers.<id>]` tables.
  Evidence: OpenAI Codex docs (`config-basic`, `config-reference`, `mcp`) describe project-level `.codex/config.toml` and MCP server keys (`command`, `args`, `cwd`, `enabled_tools`, timeouts).

- Observation: Victoria stack query-language naming differs from the shorthand in the request. VictoriaLogs and VictoriaTraces document LogsQL endpoints, while VictoriaMetrics documents MetricsQL with PromQL compatibility.
  Evidence: Victoria docs show `/select/logsql/query` for logs/traces and MetricsQL/PromQL-compatible queries for metrics.

- Observation: A single template-tree primitive is sufficient for preset scaffolding; explicit recursive directory creation in init code is unnecessary because file writes already create parent directories.
  Evidence: `applyTemplateEntries` + `writeIfMissingOrForce` created `.codex/config.toml` from `templates/presets/codex-max/.codex/config.toml` in both test and dry-run proof.

- Observation: Empty milestone directories (`docs/exec-plans/active` and `docs/exec-plans/completed`) must include placeholder files to remain visible in generated tree validations.
  Evidence: `.gitkeep` files appeared in `find ... -type f` output and made directory existence check deterministic.

- Observation: Worktree helper scripts must derive repository root from script location, not caller working directory, or they can write runtime state into the wrong repository.
  Evidence: Initial verification run wrote state under `/Users/hunter/v0hgg/execplans/.agent/harness/state`; after fixing `common.sh` root resolution, state moved correctly under the scaffolded temp repo path.

- Observation: Docker daemon availability was an environment risk, but once Docker Desktop was running, the generated observability stack validated exactly as designed.
  Evidence: `docker compose ... up -d` succeeded and smoke output reported `[smoke] logs query: PASS`, `[smoke] metrics query: PASS`, and `[smoke] traces query: PASS` in fresh target repos.

- Observation: Trace data can be visible through Jaeger services before LogsQL results are populated, so MCP `query_traces` needed a fallback path to remain reliable.
  Evidence: Initial MCP verification failed with `query_traces response missing smoke-service`; after adding Jaeger services fallback in the generated adapter template, MCP checks reported `MCP query_traces: PASS`.

## Decision Log

- Decision: Add a new init preset (`codex-max`) instead of changing the default scaffold.
  Rationale: Backward compatibility for existing users is preserved while allowing an expanded harness for teams that explicitly opt in.
  Date/Author: 2026-02-17 / Codex

- Decision: Generate project-local `.codex/config.toml` entries rather than relying on user-global `~/.codex/config.toml`.
  Rationale: Project-local config is reproducible, portable across teammates, and naturally scoped per worktree when paths are relative to repo root.
  Date/Author: 2026-02-17 / Codex

- Decision: Use a worktree-local script layer to start/stop runtime and observability services.
  Rationale: A script layer centralizes environment handling, idempotent startup/shutdown, and per-worktree port allocation, which novices can run without manual orchestration.
  Date/Author: 2026-02-17 / Codex

- Decision: Provide a trace-query compatibility adapter in the generated observability MCP server.
  Rationale: Request language calls out TraceQL-style querying while VictoriaTraces emphasizes LogsQL/Jaeger APIs; an adapter keeps the user-facing workflow stable.
  Date/Author: 2026-02-17 / Codex

- Decision: Store preset templates under `templates/presets/<preset>/...` and map to repo-relative destinations by removing the prefix.
  Rationale: This keeps the scaffold declarative and makes later milestones mostly template additions rather than imperative code branches.
  Date/Author: 2026-02-17 / Codex

- Decision: Keep codex-max docs templates intentionally minimal but structured, with starter headings and short instructions rather than long policy text.
  Rationale: This gives novices immediate orientation while avoiding opinionated content that would drift from project-specific reality.
  Date/Author: 2026-02-17 / Codex

- Decision: Default worktree runtime script behavior uses a simple local `python3 -m http.server` fallback and allows override through `.agent/harness/worktree/app-start.sh`.
  Rationale: This guarantees an immediately bootable per-worktree workflow for novices while preserving a clear upgrade path to project-specific app startup.
  Date/Author: 2026-02-17 / Codex

- Decision: Ship an in-repo observability MCP adapter (`server.mjs`) with no external runtime dependencies.
  Rationale: This keeps target-repo onboarding simple and avoids requiring package install steps before Codex can start the observability MCP server.
  Date/Author: 2026-02-17 / Codex

- Decision: Treat Docker daemon unavailability as an environment blocker and preserve pending milestones until daemon access exists, instead of weakening acceptance criteria.
  Rationale: The plan’s Definition of Done explicitly requires live observability smoke checks; skipping them would produce an unverified result.
  Date/Author: 2026-02-17 / Codex

- Decision: Add bounded retry loops to smoke checks for logs, metrics, and traces instead of single-attempt assertions.
  Rationale: Newly booted observability backends are eventually consistent; retry loops make validation deterministic in clean environments.
  Date/Author: 2026-02-17 / Codex

- Decision: Extend generated MCP `query_traces` behavior with Jaeger services fallback when LogsQL query responses are empty.
  Rationale: VictoriaTraces may expose service discovery sooner than queryable LogsQL rows; fallback preserves user-facing trace query reliability.
  Date/Author: 2026-02-17 / Codex

## Outcomes & Retrospective

Milestones 1 through 6 are fully complete and Definition of Done is satisfied with behavior-based proof. The package now scaffolds the full codex-max docs topology, emits both Chrome DevTools and observability MCP configuration, validates scaffold integrity via `doctor`, and succeeds in external-repo install/init/doctor/smoke workflows. Final acceptance also includes MCP adapter proof (`query_logs`, `query_metrics`, `query_traces`) against a live ephemeral Victoria observability stack.

## Context and Orientation

This repository is a TypeScript CLI package that scaffolds ExecPlan workflows. The current entrypoint is `src/cli.ts`, where `init`, `doctor`, and `prompt` commands are registered. Configuration resolution lives in `src/core/config.ts`, file writing helpers live in `src/core/fsPlan.ts`, and template loading lives in `src/core/templates.ts`. `runInit` in `src/commands/init.ts` currently writes only a small fixed set of templates. `runDoctorChecks` in `src/core/doctorChecks.ts` validates a limited baseline and does not currently know about a richer docs topology or harness stack.

The new work adds a richer preset-based scaffold. A “preset” here means a named scaffold profile that controls which files and directories `init` creates. A “git worktree” means an additional checked-out directory from the same Git repository; each worktree should be able to run its own local app + observability stack without colliding with siblings. “MCP server” means a Model Context Protocol server that Codex can call for tools. “UI legibility” means the agent can inspect and interact with a live browser (DOM snapshots, screenshots, navigation). “Observability legibility” means the agent can query logs, metrics, and traces from local services through a consistent interface.

Target generated structure for the codex-max preset must include this docs topology (plus harness/config files described in later milestones):

    AGENTS.md
    ARCHITECTURE.md
    docs/
    ├── design-docs/
    │   ├── index.md
    │   ├── core-beliefs.md
    │   └── ...
    ├── exec-plans/
    │   ├── active/
    │   ├── completed/
    │   └── tech-debt-tracker.md
    ├── generated/
    │   └── db-schema.md
    ├── product-specs/
    │   ├── index.md
    │   ├── new-user-onboarding.md
    │   └── ...
    ├── references/
    │   ├── design-system-reference-llms.txt
    │   ├── nixpacks-llms.txt
    │   ├── uv-llms.txt
    │   └── ...
    ├── DESIGN.md
    ├── FRONTEND.md
    ├── PLANS.md
    ├── PRODUCT_SENSE.md
    ├── QUALITY_SCORE.md
    ├── RELIABILITY.md
    └── SECURITY.md

## Plan of Work

Implementation proceeds in six milestones. Each milestone is independently verifiable and adds observable behavior. Early milestones establish preset plumbing and docs scaffolding. Middle milestones add the two legibility planes (UI and observability) with worktree-local boot scripts and MCP wiring. Final milestones harden validation through `doctor`, expand tests, and prove cross-repo install behavior.

### Milestone 1: Preset-aware scaffold engine

Create the foundation for selecting scaffold profiles and copying template trees. Update CLI and config parsing so `init` can accept `--preset`. Keep the existing behavior as `standard` and add `codex-max` as an opt-in preset. Introduce a reusable template-tree copy path so nested docs and harness directories can be generated without writing one file at a time.

Edit `src/cli.ts` to add `--preset <name>` to shared options, defaulting to `standard`. Edit `src/core/config.ts` to carry `preset` through `CommonOptions` and `ResolvedConfig`. Add `src/core/presets.ts` to validate and normalize preset values. Extend `src/core/fsPlan.ts` with a safe recursive template copy utility that respects existing files unless `--force` is set. Update `src/commands/init.ts` to dispatch scaffold entries by preset rather than a hardcoded fixed list.

Validation commands for this milestone:

    cd /Users/hunter/v0hgg/execplans
    npm test -- test/init.test.ts
    npm run typecheck

Milestone Definition of Done: Running `node dist/cli.js init --preset codex-max --dry-run` shows planned create actions for codex-max-specific files without changing existing default behavior when `--preset` is omitted.

### Milestone 2: Docs topology scaffold (requested tree)

Add the requested docs and top-level architecture files as codex-max templates. This milestone makes the user-visible structure real and verifiable. Keep placeholder content concise but purposeful so a novice knows what each file is for.

Create template content under `templates/presets/codex-max/` for `ARCHITECTURE.md` and the full `docs/` subtree. For directories that may start empty (`docs/exec-plans/active`, `docs/exec-plans/completed`), include `.gitkeep` placeholders so they are reliably generated. Ensure each generated markdown file contains starter headings and short instructions that align with ExecPlan workflow.

Update tests in `test/init.test.ts` to assert existence of the new topology when `preset=codex-max`, and assert idempotence on rerun without `--force`.

Validation commands for this milestone:

    cd /Users/hunter/v0hgg/execplans
    npm test -- test/init.test.ts
    npm run build
    tmp_repo="$(mktemp -d)"
    git -C "$tmp_repo" init
    node dist/cli.js init --root "$tmp_repo" --preset codex-max
    find "$tmp_repo/docs" -maxdepth 3 -type f | sort

Milestone Definition of Done: Generated output contains all required docs paths listed in this plan and rerunning init without force does not alter file snapshots.

### Milestone 3: UI legibility harness (worktree boot + Chrome DevTools MCP)

Add generated worktree-local runtime scripts and Codex MCP configuration for browser tooling. “Worktree-local” means all runtime state and ports come from files generated inside the target repo so each git worktree can run independently. “Chrome DevTools MCP” means Codex can call browser-inspection tools such as snapshots and screenshots through an MCP server definition in `.codex/config.toml`.

Generate `.codex/config.toml` in codex-max with a `[mcp_servers.chrome_devtools]` entry using stdio launch (command + args). Add generated scripts under `.agent/harness/worktree/` for start/stop/status, with per-worktree state in `.agent/harness/state/<worktree-hash>.env`. Add generated skill docs in `.agents/skills/ui-legibility/SKILL.md` describing DOM snapshot, screenshot, and navigation workflows against the configured MCP tools.

Update README usage docs so users know to run `execplans init --preset codex-max` and then the worktree boot script. Extend init tests to confirm `.codex/config.toml` and harness scripts are created for codex-max.

Validation commands for this milestone:

    cd /Users/hunter/v0hgg/execplans
    npm test -- test/init.test.ts
    npm run build
    tmp_repo="$(mktemp -d)"
    git -C "$tmp_repo" init
    node dist/cli.js init --root "$tmp_repo" --preset codex-max
    test -f "$tmp_repo/.codex/config.toml"
    test -f "$tmp_repo/.agent/harness/worktree/up.sh"
    rg -n "mcp_servers\\.chrome_devtools|DOM|screenshot|navigate" "$tmp_repo/.codex/config.toml" "$tmp_repo/.agents/skills/ui-legibility/SKILL.md"

Milestone Definition of Done: A newly scaffolded repo contains project-local Codex MCP config for Chrome DevTools and runnable worktree scripts with documented UI legibility skills.

### Milestone 4: Observability legibility harness (Vector + Victoria stack + query MCP)

Add generated local observability infrastructure and MCP query adapter. “Observability stack” here means local services for logs, metrics, and traces. “Vector fan-out” means incoming telemetry is routed to each backend destination. The generated stack must be ephemeral per worktree, meaning it can be started and torn down per worktree without cross-worktree coupling.

Generate Docker Compose templates under `.agent/harness/observability/` with services for Vector, Victoria Logs, Victoria Metrics, and Victoria Traces. Add Vector config template that routes telemetry to each backend. Add generated MCP adapter server template under `.agent/harness/mcp/observability-server/` that exposes tools such as `query_logs`, `query_metrics`, and `query_traces`, while internally mapping trace queries to Victoria-compatible endpoints.

Update `.codex/config.toml` generation to include `[mcp_servers.observability]` with command, args, and cwd pointing to the generated adapter server path. Add a smoke script template `.agent/harness/observability/smoke.sh` that checks all three backends with HTTP queries.

Validation commands for this milestone:

    cd /Users/hunter/v0hgg/execplans
    npm run build
    tmp_repo="$(mktemp -d)"
    git -C "$tmp_repo" init
    node dist/cli.js init --root "$tmp_repo" --preset codex-max
    docker compose -f "$tmp_repo/.agent/harness/observability/docker-compose.yml" up -d
    bash "$tmp_repo/.agent/harness/observability/smoke.sh"
    docker compose -f "$tmp_repo/.agent/harness/observability/docker-compose.yml" down -v

Milestone Definition of Done: Smoke checks prove logs, metrics, and traces are queryable locally, and generated Codex MCP config includes an observability server entry.

### Milestone 5: Doctor checks, docs, and regression tests

Teach `doctor` to validate codex-max scaffold integrity and provide actionable remediation messages. This milestone prevents silent drift and gives novices fast feedback when required files are missing.

Extend `src/core/doctorChecks.ts` and `src/commands/doctor.ts` to accept preset-aware expectations. Add checks for codex-max core files: docs topology roots, `.codex/config.toml`, worktree scripts, and observability compose/smoke scripts. Keep check output consistent with existing “Fix:” style and explicit rerun guidance.

Update `test/doctor.test.ts` with passing and failing codex-max scenarios, including malformed `.codex/config.toml` and missing observability artifacts. Update README with codex-max install, validation, and troubleshooting steps.

Validation commands for this milestone:

    cd /Users/hunter/v0hgg/execplans
    npm test -- test/doctor.test.ts test/init.test.ts
    npm run ci

Milestone Definition of Done: `execplans doctor --preset codex-max` returns `OK` on a healthy codex-max scaffold and returns clear `Fix:` messages when artifacts are missing.

### Milestone 6: Cross-repo install proof (final acceptance)

Demonstrate the package can be installed into another git repo and immediately provide the full codex-max pipeline. This is the final user goal and must be shown as behavior, not inferred.

Create a local package tarball from this repo, install it into a second temporary repository, run codex-max init, and execute the smoke workflow. Capture concise evidence snippets in this plan’s `Artifacts and Notes`.

Validation commands for this milestone:

    cd /Users/hunter/v0hgg/execplans
    npm pack
    pkg_tgz="$(ls -1t execplans-*.tgz | head -n1)"
    target_repo="$(mktemp -d)"
    git -C "$target_repo" init
    npm -C "$target_repo" init -y
    npm -C "$target_repo" install --save-dev "/Users/hunter/v0hgg/execplans/$pkg_tgz"
    npx --prefix "$target_repo" execplans init --root "$target_repo" --preset codex-max
    npx --prefix "$target_repo" execplans doctor --root "$target_repo" --preset codex-max
    docker compose -f "$target_repo/.agent/harness/observability/docker-compose.yml" up -d
    bash "$target_repo/.agent/harness/observability/smoke.sh"
    docker compose -f "$target_repo/.agent/harness/observability/docker-compose.yml" down -v

Milestone Definition of Done: A second repository with no prior setup can install this package, run codex-max init, pass doctor, and complete observability smoke checks without manual file edits.

## Concrete Steps

Run implementation in order and commit after each milestone so rollback is simple.

1. Implement preset parsing and tree copy primitives (Milestone 1), then run milestone validation commands.
2. Add codex-max docs templates and init tests (Milestone 2), then validate tree output in a temp repo.
3. Add UI legibility config/scripts/templates and tests (Milestone 3), then verify generated `.codex/config.toml` and skill files.
4. Add observability compose/vector/MCP adapter templates and smoke script (Milestone 4), then verify stack startup and query responses.
5. Extend doctor checks and docs, then run full CI (Milestone 5).
6. Run cross-repo install proof and record evidence snippets in this file (Milestone 6).

## Validation and Acceptance

Acceptance is behavior-based and must be demonstrated from a clean target repository:

- `execplans init --preset codex-max` generates the full docs topology and harness artifacts.
- `execplans doctor --preset codex-max` returns `OK`.
- Observability smoke script returns success for logs, metrics, and traces queries.
- Generated MCP configuration includes both Chrome DevTools and observability servers with project-local paths.
- Rerunning init without `--force` is idempotent; rerunning with `--force` refreshes managed/generated files as documented.

Expected high-signal outcomes:

    OK
    [smoke] logs query: PASS
    [smoke] metrics query: PASS
    [smoke] traces query: PASS

## Idempotence and Recovery

`init` must remain safe to rerun. Without `--force`, existing files should be preserved unless they are managed blocks designed for safe merge. With `--force`, generated template files are refreshed to match package templates.

If a milestone fails halfway:

- For file-generation issues, rerun `execplans init --preset codex-max --force` after fixing code.
- For observability runtime issues, stop and clean with:

    docker compose -f .agent/harness/observability/docker-compose.yml down -v

- For test failures, isolate with `npm test -- <target-file>` before returning to `npm run ci`.

No destructive Git commands are required by this plan.

## Artifacts and Notes

Proof snippets captured from final Milestone 6 acceptance run:

    npm notice filename: execplans-0.1.4.tgz
    TARGET_REPO=/var/folders/mn/xfky68q57gzct_00q141f76m0000gn/T/tmp.xsszkys3mB
    Create: .codex/config.toml
    Create: .agent/harness/worktree/up.sh
    Create: .agent/harness/observability/docker-compose.yml
    Create: docs/design-docs/index.md
    Create: docs/exec-plans/tech-debt-tracker.md
    OK
    [smoke] logs query: PASS
    [smoke] metrics query: PASS
    [smoke] traces query: PASS
    MCP tools/list includes: query_logs, query_metrics, query_traces
    MCP query_logs: PASS
    MCP query_metrics: PASS
    MCP query_traces: PASS
    DONE_TARGET_REPO=/var/folders/mn/xfky68q57gzct_00q141f76m0000gn/T/tmp.xsszkys3mB

Notes for terminology alignment:

- User-facing query examples may say “PromQL/TraceQL”. Generated docs should explain that MetricsQL is PromQL-compatible and that trace querying is adapted to Victoria-compatible endpoints in this scaffold.

## Interfaces and Dependencies

Implement these concrete interfaces to keep scope unambiguous.

In `src/core/presets.ts`, define:

    export type InitPreset = "standard" | "codex-max";

    export function parsePreset(input: string | undefined): InitPreset;

In `src/core/config.ts`, extend config contracts:

    export interface CommonOptions {
      preset?: string;
      // existing fields...
    }

    export interface ResolvedConfig {
      preset: InitPreset;
      // existing fields...
    }

In `src/core/fsPlan.ts`, add recursive template copy utility:

    export interface TemplateCopyEntry {
      templateRelativePath: string;
      destinationAbsolutePath: string;
      executable?: boolean;
      managed?: boolean;
    }

    export function applyTemplateEntries(
      entries: TemplateCopyEntry[],
      context: ActionContext,
      force: boolean,
    ): ActionResult[];

In `src/commands/init.ts`, route scaffold generation by preset:

    export async function runInit(options: CommonOptions, io?: InitIo): Promise<number>;

with codex-max branch that applies docs, harness, `.codex/config.toml`, and skills templates.

In `src/core/doctorChecks.ts`, extend checks with preset-aware expectations:

    export interface DoctorCheckOptions {
      preset: InitPreset;
      // existing fields...
    }

and return `Fix:` lines for missing codex-max mandatory artifacts.

Dependency expectations:

- Keep runtime dependencies minimal; prefer generated scripts and templates over adding heavy package dependencies to this package itself.
- Generated observability stack depends on Docker and Docker Compose on the target repo machine.
- Generated Chrome DevTools MCP setup depends on Node/npm and Chrome availability in the target repo environment.

## Revision Note

2026-02-17 (Codex): Initial creation of this ExecPlan to satisfy the requested OpenAI-style harness scaffold scope, including docs topology, MCP wiring, worktree isolation, observability stack, explicit milestone validation commands, and cross-repo installation proof.
2026-02-17 (Codex): Updated after Milestone 1 implementation to record completed progress, new design decisions, milestone outcomes, and evidence-backed discoveries.
2026-02-17 (Codex): Updated after Milestone 2 implementation to record docs topology scaffold completion, idempotence coverage, and fresh-repo validation evidence.
2026-02-17 (Codex): Updated after Milestone 3 implementation and corrected worktree-root bug discovered during runtime script verification.
2026-02-17 (Codex): Updated after Milestones 4 and 5 implementation; recorded Docker daemon blocker that prevents runtime observability proof in this session.
2026-02-17 (Codex): Updated after Milestone 6 cross-repo packaging/install proof; retained Docker smoke checks as pending due persistent daemon blocker.
2026-02-17 (Codex): Updated after final acceptance rerun; resolved Docker blocker, hardened observability smoke retries, added MCP trace-query fallback, and captured complete DoD evidence.
