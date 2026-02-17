import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { MANAGED_BEGIN, MANAGED_END } from "./managedBlock";
import { InitPreset } from "./presets";

const REQUIRED_PLAN_HEADINGS = [
  "## Progress",
  "## Surprises & Discoveries",
  "## Decision Log",
  "## Outcomes & Retrospective",
];

const CODEX_MAX_REQUIRED_RELATIVE_PATHS = [
  "ARCHITECTURE.md",
  ".codex/config.toml",
  "docs/design-docs/index.md",
  "docs/exec-plans/tech-debt-tracker.md",
  "docs/generated/db-schema.md",
  "docs/product-specs/index.md",
  "docs/references/design-system-reference-llms.txt",
  "docs/SECURITY.md",
  ".agent/harness/worktree/up.sh",
  ".agent/harness/worktree/down.sh",
  ".agent/harness/worktree/status.sh",
  ".agent/harness/observability/docker-compose.yml",
  ".agent/harness/observability/smoke.sh",
  ".agent/harness/observability/vector/vector.yaml",
  ".agent/harness/mcp/observability-server/server.mjs",
  ".agents/skills/ui-legibility/SKILL.md",
];

function hasManagedMarkers(content: string): boolean {
  const begin = content.includes(MANAGED_BEGIN);
  const end = content.includes(MANAGED_END);
  return begin && end;
}

function parseFrontmatter(filePath: string): Record<string, unknown> | undefined {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!match) {
    return undefined;
  }

  try {
    const parsed = YAML.parse(match[1]);
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export interface DoctorCheckOptions {
  root: string;
  preset: InitPreset;
  plansFilePath: string;
  execplansDirPath: string;
  agentsFilePath: string;
  claudeFilePath: string;
  execplanCreateSkillPath: string;
  execplanExecuteSkillPath: string;
  checkAgentsFile: boolean;
  checkClaudeFile: boolean;
  checkCodexSkills: boolean;
}

export function runDoctorChecks(options: DoctorCheckOptions): string[] {
  const fixes: string[] = [];

  if (!fs.existsSync(options.plansFilePath)) {
    fixes.push(`Fix: Create ${options.plansFilePath} (run \`execplans init\`).`);
  }

  if (!fs.existsSync(options.execplansDirPath)) {
    fixes.push(`Fix: Create ${options.execplansDirPath} directory (run \`execplans init\`).`);
  }

  if (options.checkAgentsFile) {
    if (!fs.existsSync(options.agentsFilePath)) {
      fixes.push(`Fix: Create ${options.agentsFilePath} with execplans managed block (run \`execplans init\`).`);
    } else {
      const content = fs.readFileSync(options.agentsFilePath, "utf8");
      if (!hasManagedMarkers(content)) {
        fixes.push(
          `Fix: Add ${MANAGED_BEGIN} and ${MANAGED_END} markers to ${options.agentsFilePath} (or rerun \`execplans init\`).`,
        );
      }
    }
  }

  if (options.checkClaudeFile) {
    if (!fs.existsSync(options.claudeFilePath)) {
      fixes.push(`Fix: Create ${options.claudeFilePath} with execplans managed block (run \`execplans init\`).`);
    } else {
      const content = fs.readFileSync(options.claudeFilePath, "utf8");
      if (!hasManagedMarkers(content)) {
        fixes.push(
          `Fix: Add ${MANAGED_BEGIN} and ${MANAGED_END} markers to ${options.claudeFilePath} (or rerun \`execplans init\`).`,
        );
      }
    }
  }

  if (fs.existsSync(options.plansFilePath)) {
    const plansContent = fs.readFileSync(options.plansFilePath, "utf8");
    for (const heading of REQUIRED_PLAN_HEADINGS) {
      if (!plansContent.includes(heading)) {
        fixes.push(`Fix: Add required heading \"${heading}\" to ${options.plansFilePath}.`);
      }
    }
  }

  if (options.checkCodexSkills) {
    const skillFiles = [options.execplanCreateSkillPath, options.execplanExecuteSkillPath];

    for (const skillPath of skillFiles) {
      if (!fs.existsSync(skillPath)) {
        fixes.push(`Fix: Create ${skillPath} (run \`execplans init\`).`);
        continue;
      }

      const frontmatter = parseFrontmatter(skillPath);
      if (!frontmatter) {
        fixes.push(
          `Fix: Add YAML frontmatter with non-empty name and description to ${skillPath}.`,
        );
        continue;
      }

      const name = frontmatter.name;
      const description = frontmatter.description;
      if (typeof name !== "string" || name.trim().length === 0) {
        fixes.push(`Fix: Set non-empty frontmatter field \"name\" in ${skillPath}.`);
      }

      if (typeof description !== "string" || description.trim().length === 0) {
        fixes.push(`Fix: Set non-empty frontmatter field \"description\" in ${skillPath}.`);
      }
    }
  }

  if (options.preset === "codex-max") {
    for (const relativePath of CODEX_MAX_REQUIRED_RELATIVE_PATHS) {
      const absolutePath = path.resolve(options.root, relativePath);
      if (!fs.existsSync(absolutePath)) {
        fixes.push(`Fix: Create ${absolutePath} (run \`execplans init --preset codex-max\`).`);
      }
    }

    const codexConfigPath = path.resolve(options.root, ".codex/config.toml");
    if (fs.existsSync(codexConfigPath)) {
      const codexConfig = fs.readFileSync(codexConfigPath, "utf8");
      if (!codexConfig.includes("[mcp_servers.chrome_devtools]")) {
        fixes.push(
          `Fix: Add [mcp_servers.chrome_devtools] block to ${codexConfigPath} (or rerun \`execplans init --preset codex-max\`).`,
        );
      }

      if (!codexConfig.includes("[mcp_servers.observability]")) {
        fixes.push(
          `Fix: Add [mcp_servers.observability] block to ${codexConfigPath} (or rerun \`execplans init --preset codex-max\`).`,
        );
      }
    }
  }

  return fixes;
}
