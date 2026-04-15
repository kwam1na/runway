export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

import { runHarnessAudit } from "./harness/audit.js";
import { runHarnessCheck } from "./harness/check.js";
import { generateHarnessArtifacts } from "./harness/generate.js";
import { selectValidationsForFiles } from "./harness/review.js";

const supportedCommands = [
  "generate",
  "check",
  "review",
  "audit",
  "behavior",
  "inferential-review",
  "runtime-trends",
  "scorecard",
  "janitor",
  "help",
] as const;

function jsonResult(command: string, payload: Record<string, unknown>, exitCode = 0): CliResult {
  return {
    exitCode,
    stdout: JSON.stringify({ command, ...payload }),
    stderr: "",
  };
}

export async function runCli(args: string[]): Promise<CliResult> {
  const command = args[0] ?? "help";

  if (command === "help") {
    return {
      exitCode: 0,
      stdout: `Available commands:\n${supportedCommands.join("\n")}`,
      stderr: "",
    };
  }

  if (!supportedCommands.includes(command as (typeof supportedCommands)[number])) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Unknown command: ${command}`,
    };
  }

  if (command === "generate") {
    const outputs = await generateHarnessArtifacts();
    return jsonResult(command, { outputs });
  }

  if (command === "check") {
    const result = await runHarnessCheck();
    return result.ok
      ? jsonResult(command, { checkedPaths: result.checkedPaths })
      : {
          exitCode: 1,
          stdout: "",
          stderr: result.errors.join("\n"),
        };
  }

  if (command === "review") {
    const touchedFiles = args.slice(1);
    const selection = await selectValidationsForFiles(touchedFiles);
    return selection.commands.length > 0
      ? jsonResult(command, {
          touchedFiles: selection.touchedFiles,
          scripts: selection.commands.map((entry) => entry.script),
          behaviorScenarios: selection.behaviorScenarios,
        })
      : {
          exitCode: 1,
          stdout: "",
          stderr: touchedFiles.length === 0 ? "No files supplied for review." : "No validations selected.",
        };
  }

  if (command === "audit") {
    const result = await runHarnessAudit({
      candidateFiles: args.length > 1 ? args.slice(1) : undefined,
    });
    return result.ok
      ? jsonResult(command, {
          auditedRoots: result.auditedRoots,
          candidateFiles: result.candidateFiles,
        })
      : {
          exitCode: 1,
          stdout: "",
          stderr: result.errors.join("\n"),
        };
  }

  return {
    exitCode: 0,
    stdout: `stub:${command}`,
    stderr: "",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runCli(process.argv.slice(2));
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exit(result.exitCode);
}
