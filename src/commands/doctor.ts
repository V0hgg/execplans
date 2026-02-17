import { CommonOptions, resolveConfig } from "../core/config";
import { runDoctorChecks } from "../core/doctorChecks";

export interface DoctorIo {
  log: (line: string) => void;
}

const defaultIo: DoctorIo = {
  log: (line: string) => {
    console.log(line);
  },
};

export async function runDoctor(options: CommonOptions, io: DoctorIo = defaultIo): Promise<number> {
  const config = resolveConfig(options);

  const fixes = runDoctorChecks({
    root: config.root,
    preset: config.preset,
    plansFilePath: config.plansFilePath,
    execplansDirPath: config.execplansDirPath,
    agentsFilePath: config.agentsFilePath,
    claudeFilePath: config.claudeFilePath,
    execplanCreateSkillPath: config.execplanCreateSkillPath,
    execplanExecuteSkillPath: config.execplanExecuteSkillPath,
    checkAgentsFile: config.assistants.needsAgentsFile,
    checkClaudeFile: config.assistants.needsClaudeFile,
    checkCodexSkills: config.assistants.needsCodexSkills,
  });

  if (fixes.length === 0) {
    io.log("OK");
    return 0;
  }

  for (const line of fixes) {
    io.log(line);
  }

  return 1;
}
