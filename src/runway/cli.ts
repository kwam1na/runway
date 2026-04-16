import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

import { runAgentWorkflow } from "./agents/index.js";
import { runHarnessAudit } from "./harness/audit.js";
import { runBehaviorScenarios } from "./harness/behavior.js";
import { runHarnessCheck } from "./harness/check.js";
import { generateHarnessArtifacts } from "./harness/generate.js";
import { runInferentialReview } from "./harness/inferential-review.js";
import { runJanitor } from "./harness/janitor.js";
import { selectValidationsForFiles } from "./harness/review.js";
import { buildRuntimeTrends } from "./harness/runtime-trends.js";
import { buildScorecard } from "./harness/scorecard.js";
import { analyzeProfileFile } from "./finance/analysis-runner.js";
import {
  buildStatementIngestionRequest,
  resolveDefaultProfilePath,
  runInteractiveAssist,
} from "./interactive-assist.js";

const supportedCommands = [
  "analyze",
  "assist",
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

async function readJsonFile<T>(path: string, invalidMessage: string): Promise<{ ok: true; payload: T } | {
  ok: false;
  error: string;
}> {
  const raw = await readFile(path, "utf8");

  try {
    return {
      ok: true,
      payload: JSON.parse(raw) as T,
    };
  } catch {
    return {
      ok: false,
      error: invalidMessage,
    };
  }
}

function isInteractiveAssistSession(patchPath: string | undefined): boolean {
  return !patchPath && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}

async function askInteractiveQuestion(question: string): Promise<string> {
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return await prompt.question(`${question}\n> `);
  } finally {
    prompt.close();
  }
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

  if (command === "analyze") {
    const profilePath = args[1];

    if (!profilePath) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Usage: analyze <profile-path>",
      };
    }

    try {
      const outcome = await analyzeProfileFile(profilePath);

      if (!outcome.ok) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: outcome.errors
            .map((error) =>
              [error.path, error.message, error.question].filter(Boolean).join(": "),
            )
            .join("\n"),
        };
      }

      return jsonResult(command, {
        profilePath,
        result: outcome.result,
        report: outcome.report,
      });
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (command === "assist") {
    const assistArgs = args.slice(1);
    const statementRequest = buildStatementIngestionRequest(assistArgs);
    const statementMarkerIndex = assistArgs.indexOf("--statements");
    const positionalArgs = statementMarkerIndex >= 0 ? assistArgs.slice(0, statementMarkerIndex) : assistArgs;
    const profilePath = positionalArgs[0];
    const patchPath = positionalArgs[1];
    const interactiveSession = isInteractiveAssistSession(patchPath);
    const resolvedProfilePath = profilePath ?? (interactiveSession ? await resolveDefaultProfilePath() : undefined);

    if (statementMarkerIndex >= 0 && statementRequest.statementPaths.length === 0) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Usage: assist [profile-path] [answer-patch-path] [--statements <file> ...]",
      };
    }

    if (!resolvedProfilePath) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: "Usage: assist [profile-path] [answer-patch-path]\nOmit profile-path only in an interactive TTY session.",
      };
    }

    try {
      if (interactiveSession) {
        const outcome = await runInteractiveAssist({
          profilePath: resolvedProfilePath,
          ask: askInteractiveQuestion,
          isInteractive: true,
          ...(statementRequest.statementPaths.length > 0
            ? { statementPaths: statementRequest.statementPaths }
            : {}),
        });

        return outcome.status === "needs-input"
          ? jsonResult(command, {
              status: outcome.status,
              profilePath: resolvedProfilePath,
              profile: outcome.profile,
              validationIssues: outcome.validationIssues,
              followUpQuestions: outcome.followUpQuestions.map((issue) => ({
                path: issue.path,
                question: issue.question,
              })),
            })
          : jsonResult(command, {
              status: outcome.status,
              profilePath: resolvedProfilePath,
              profile: outcome.profile,
              result: outcome.result,
              report: outcome.report,
            });
      }

      const profilePayload = await readJsonFile<Record<string, unknown>>(
        resolvedProfilePath,
        "Profile file must contain valid JSON.",
      );
      if (!profilePayload.ok) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: profilePayload.error,
        };
      }

      const patchPayload = patchPath
        ? await readJsonFile<Record<string, unknown>>(patchPath, "Answer patch file must contain valid JSON.")
        : undefined;
      if (patchPayload && !patchPayload.ok) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: patchPayload.error,
        };
      }

      const outcome = runAgentWorkflow(
        profilePayload.payload,
        patchPayload && patchPayload.ok ? patchPayload.payload : undefined,
      );

      return outcome.status === "needs-input"
        ? jsonResult(command, {
            status: outcome.status,
            profilePath: resolvedProfilePath,
            patchPath,
            profile: outcome.profile,
            validationIssues: outcome.validationIssues,
            followUpQuestions: outcome.followUpQuestions.map((issue) => ({
              path: issue.path,
              question: issue.question,
            })),
          })
        : jsonResult(command, {
            status: outcome.status,
            profilePath: resolvedProfilePath,
            patchPath,
            profile: outcome.profile,
            result: outcome.result,
            report: outcome.report,
          });
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
      };
    }
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

  if (command === "behavior") {
    const result = await runBehaviorScenarios();
    return jsonResult(command, result);
  }

  if (command === "runtime-trends") {
    return {
      exitCode: 0,
      stdout: await buildRuntimeTrends(),
      stderr: "",
    };
  }

  if (command === "scorecard") {
    return {
      exitCode: 0,
      stdout: await buildScorecard(),
      stderr: "",
    };
  }

  if (command === "inferential-review") {
    return {
      exitCode: 0,
      stdout: await runInferentialReview(),
      stderr: "",
    };
  }

  if (command === "janitor") {
    const result = await runJanitor();
    return jsonResult(command, result);
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
