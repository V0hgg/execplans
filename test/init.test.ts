import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runInit } from "../src/commands/init";
import { readTemplate } from "../src/core/templates";
import { captureIo, createTempWorkspace, initGitMarker, readFile, snapshotFileTree, writeFile } from "./helpers";

describe("init", () => {
  it("creates expected structure in empty folder for assistants=all", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    const io = captureIo();
    const code = await runInit({ root }, io.io);

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(root, "AGENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(root, "CLAUDE.md"))).toBe(true);
    expect(fs.existsSync(path.join(root, ".agent", "PLANS.md"))).toBe(true);
    expect(fs.existsSync(path.join(root, ".agent", "execplans", "README.md"))).toBe(true);
    expect(
      fs.existsSync(path.join(root, ".agents", "skills", "execplan-create", "SKILL.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(root, ".agents", "skills", "execplan-execute", "SKILL.md")),
    ).toBe(true);

    const agents = readFile(root, "AGENTS.md");
    expect(agents).toContain("<!-- execplans:begin -->");
    expect(agents).toContain("<!-- execplans:end -->");

    const skill = readFile(root, ".agents/skills/execplan-create/SKILL.md");
    expect(skill).toContain("name: execplan-create");
    expect(skill).toContain("description:");

    expect(io.lines.some((line) => line.startsWith("Create:"))).toBe(true);
  });

  it("is idempotent on rerun without force", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    await runInit({ root });
    const before = snapshotFileTree(root);

    await runInit({ root });
    const after = snapshotFileTree(root);

    expect(after).toEqual(before);
  });

  it("preserves AGENTS custom text while appending/updating managed block", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    writeFile(root, "AGENTS.md", "# Team Rules\n\nDo not remove this line.\n");

    await runInit({ root, assistants: "codex" });
    const first = readFile(root, "AGENTS.md");

    expect(first).toContain("Do not remove this line.");
    expect(first).toContain("<!-- execplans:begin -->");
    expect(first).toContain("<!-- execplans:end -->");

    await runInit({ root, assistants: "codex" });
    const second = readFile(root, "AGENTS.md");

    expect(second).toContain("Do not remove this line.");
    expect(second.match(/<!-- execplans:begin -->/g)?.length).toBe(1);
  });

  it("updates only the managed region when markers already exist", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    writeFile(
      root,
      "AGENTS.md",
      [
        "# Custom Header",
        "",
        "<!-- execplans:begin -->",
        "old block",
        "<!-- execplans:end -->",
        "",
        "Footer note",
        "",
      ].join("\n"),
    );

    await runInit({ root, assistants: "codex" });

    const content = readFile(root, "AGENTS.md");
    expect(content.startsWith("# Custom Header")).toBe(true);
    expect(content).toContain("Footer note");
    expect(content).toContain(
      "When writing complex features or significant refactors, use an ExecPlan",
    );
    expect(content).not.toContain("old block");
  });

  it("leaves existing PLANS unchanged unless force", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    writeFile(root, ".agent/PLANS.md", "# Custom Plans\n");

    await runInit({ root });
    const withoutForce = readFile(root, ".agent/PLANS.md");
    expect(withoutForce).toBe("# Custom Plans\n");

    await runInit({ root, force: true });
    const withForce = readFile(root, ".agent/PLANS.md");
    expect(withForce).toBe(readTemplate("PLANS.md"));
  });

  it("supports dry-run without writing files", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    const io = captureIo();
    await runInit({ root, dryRun: true }, io.io);

    expect(io.lines.some((line) => line.startsWith("Would Create:"))).toBe(true);
    expect(fs.existsSync(path.join(root, "AGENTS.md"))).toBe(false);
  });

  it("applies codex-max preset templates", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    await runInit({ root, preset: "codex-max" });

    expect(fs.existsSync(path.join(root, ".codex", "config.toml"))).toBe(true);
    expect(fs.existsSync(path.join(root, "ARCHITECTURE.md"))).toBe(true);

    const expectedCodexMaxPaths = [
      "docs/design-docs/index.md",
      "docs/design-docs/core-beliefs.md",
      "docs/exec-plans/active/.gitkeep",
      "docs/exec-plans/completed/.gitkeep",
      "docs/exec-plans/tech-debt-tracker.md",
      "docs/generated/db-schema.md",
      "docs/product-specs/index.md",
      "docs/product-specs/new-user-onboarding.md",
      "docs/references/design-system-reference-llms.txt",
      "docs/references/nixpacks-llms.txt",
      "docs/references/uv-llms.txt",
      "docs/DESIGN.md",
      "docs/FRONTEND.md",
      "docs/PLANS.md",
      "docs/PRODUCT_SENSE.md",
      "docs/QUALITY_SCORE.md",
      "docs/RELIABILITY.md",
      "docs/SECURITY.md",
      ".agent/harness/worktree/common.sh",
      ".agent/harness/worktree/up.sh",
      ".agent/harness/worktree/down.sh",
      ".agent/harness/worktree/status.sh",
      ".agent/harness/worktree/app-start.sh",
      ".agent/harness/state/.gitkeep",
      ".agent/harness/observability/docker-compose.yml",
      ".agent/harness/observability/vector/vector.yaml",
      ".agent/harness/observability/smoke.sh",
      ".agent/harness/mcp/observability-server/package.json",
      ".agent/harness/mcp/observability-server/README.md",
      ".agent/harness/mcp/observability-server/server.mjs",
      ".agents/skills/ui-legibility/SKILL.md",
    ];

    for (const relativePath of expectedCodexMaxPaths) {
      expect(fs.existsSync(path.join(root, relativePath))).toBe(true);
    }

    const codexConfig = readFile(root, ".codex/config.toml");
    expect(codexConfig).toContain("[mcp_servers.chrome_devtools]");
    expect(codexConfig).toContain("[mcp_servers.observability]");
    expect(codexConfig).toContain("command = \"npx\"");

    const uiSkill = readFile(root, ".agents/skills/ui-legibility/SKILL.md");
    expect(uiSkill).toContain("DOM snapshots");
    expect(uiSkill).toContain("screenshots");

    const upStat = fs.statSync(path.join(root, ".agent/harness/worktree/up.sh"));
    expect((upStat.mode & 0o111) !== 0).toBe(true);

    const smokeStat = fs.statSync(path.join(root, ".agent/harness/observability/smoke.sh"));
    expect((smokeStat.mode & 0o111) !== 0).toBe(true);

    const observabilityServer = readFile(root, ".agent/harness/mcp/observability-server/server.mjs");
    expect(observabilityServer).toContain("query_logs");
    expect(observabilityServer).toContain("query_metrics");
    expect(observabilityServer).toContain("query_traces");
  });

  it("shows codex-max preset actions in dry-run", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    const io = captureIo();
    await runInit({ root, preset: "codex-max", dryRun: true }, io.io);

    expect(io.lines.some((line) => line.includes(".codex/config.toml"))).toBe(true);
  });

  it("is idempotent for codex-max on rerun without force", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    await runInit({ root, preset: "codex-max" });
    const before = snapshotFileTree(root);

    await runInit({ root, preset: "codex-max" });
    const after = snapshotFileTree(root);

    expect(after).toEqual(before);
  });
});
