import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runDoctor } from "../src/commands/doctor";
import { runInit } from "../src/commands/init";
import { captureIo, createTempWorkspace, initGitMarker, readFile, writeFile } from "./helpers";

describe("doctor", () => {
  it("prints OK after successful init", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    await runInit({ root });

    const io = captureIo();
    const code = await runDoctor({ root }, io.io);

    expect(code).toBe(0);
    expect(io.lines).toEqual(["OK"]);
  });

  it("prints actionable Fix messages when structure is broken", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    await runInit({ root });

    const plans = readFile(root, ".agent/PLANS.md").replace("## Decision Log", "## Decisions");
    writeFile(root, ".agent/PLANS.md", plans);

    const skillBody = readFile(root, ".agents/skills/execplan-create/SKILL.md");
    const withoutFrontmatter = skillBody.replace(/^---[\s\S]*?---\n?/, "");
    writeFile(root, ".agents/skills/execplan-create/SKILL.md", withoutFrontmatter);

    const io = captureIo();
    const code = await runDoctor({ root }, io.io);

    expect(code).toBe(1);
    expect(io.lines.some((line) => line.startsWith("Fix:"))).toBe(true);
    expect(io.lines.some((line) => line.includes("## Decision Log"))).toBe(true);
    expect(
      io.lines.some((line) =>
        line.includes(".agents/skills/execplan-create/SKILL.md") && line.includes("frontmatter"),
      ),
    ).toBe(true);
  });

  it("prints OK for codex-max preset when scaffold is complete", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    await runInit({ root, preset: "codex-max" });

    const io = captureIo();
    const code = await runDoctor({ root, preset: "codex-max" }, io.io);

    expect(code).toBe(0);
    expect(io.lines).toEqual(["OK"]);
  });

  it("prints codex-max specific Fix messages when preset artifacts are missing", async () => {
    const root = createTempWorkspace();
    initGitMarker(root);

    await runInit({ root, preset: "codex-max" });

    fs.unlinkSync(path.join(root, ".agent/harness/observability/smoke.sh"));
    writeFile(root, ".codex/config.toml", "[mcp_servers.chrome_devtools]\ncommand = \"npx\"\n");

    const io = captureIo();
    const code = await runDoctor({ root, preset: "codex-max" }, io.io);

    expect(code).toBe(1);
    expect(io.lines.some((line) => line.includes(".agent/harness/observability/smoke.sh"))).toBe(
      true,
    );
    expect(io.lines.some((line) => line.includes("[mcp_servers.observability]"))).toBe(true);
  });
});
