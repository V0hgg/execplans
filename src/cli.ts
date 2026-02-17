#!/usr/bin/env node

import { Command, Option } from "commander";
import fs from "node:fs";
import path from "node:path";

import { runDoctor } from "./commands/doctor";
import { runInit } from "./commands/init";
import { runPromptExec, runPromptPlan } from "./commands/prompt";

interface CommonCliOptions {
  root?: string;
  assistants?: string;
  preset?: string;
  agentsFile?: string;
  claudeFile?: string;
  planDir?: string;
  execplansDir?: string;
  skillsDir?: string;
  force?: boolean;
  dryRun?: boolean;
}

function addCommonOptions(command: Command): Command {
  return command
    .addOption(new Option("--root <path>", "set repository root"))
    .addOption(
      new Option(
        "--assistants <list>",
        "assistant targets: codex,claude,augment,all",
      ).default("all"),
    )
    .addOption(new Option("--preset <name>", "init preset: standard,codex-max").default("standard"))
    .addOption(new Option("--agents-file <name>", "AGENTS.md filename").default("AGENTS.md"))
    .addOption(new Option("--claude-file <name>", "CLAUDE.md filename").default("CLAUDE.md"))
    .addOption(new Option("--plan-dir <path>", "path to .agent directory").default(".agent"))
    .addOption(
      new Option("--execplans-dir <path>", "path to execplans directory").default(".agent/execplans"),
    )
    .addOption(new Option("--skills-dir <path>", "path to skills directory").default(".agents/skills"))
    .addOption(new Option("--force", "overwrite managed templates and blocks").default(false))
    .addOption(new Option("--dry-run", "show planned changes without writing files").default(false));
}

async function main(): Promise<void> {
  const packageJsonPath = path.resolve(__dirname, "..", "package.json");
  const packageVersion = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version as string;

  const program = new Command();
  program
    .name("codex-promax")
    .description("Scaffold and validate ExecPlan workflows")
    .version(packageVersion)
    .showHelpAfterError();

  addCommonOptions(
    program
      .command("init")
      .description("scaffold or patch repo structure for ExecPlans")
      .action(async (options: CommonCliOptions) => {
        const code = await runInit(options);
        process.exitCode = code;
      }),
  );

  const prompt = program.command("prompt").description("print assistant prompts");

  addCommonOptions(
    prompt
      .command("plan")
      .argument("<title>", "plan title")
      .option("--out <path>", "write a stub plan file")
      .description("print prompt for creating an ExecPlan")
      .action(async (title: string, options: CommonCliOptions & { out?: string }) => {
        const code = await runPromptPlan(title, options);
        process.exitCode = code;
      }),
  );

  addCommonOptions(
    prompt
      .command("exec")
      .argument("<planfile>", "path to plan file")
      .description("print prompt for executing an ExecPlan")
      .action(async (planfile: string, options: CommonCliOptions) => {
        const code = await runPromptExec(planfile, options);
        process.exitCode = code;
      }),
  );

  addCommonOptions(
    program
      .command("doctor")
      .description("validate ExecPlans structure and managed files")
      .action(async (options: CommonCliOptions) => {
        const code = await runDoctor(options);
        process.exitCode = code;
      }),
  );

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
