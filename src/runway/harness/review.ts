import type { HarnessCommand } from "./types.js";
import { harnessTargets } from "./app-registry.js";

export type ValidationSelection = {
  touchedFiles: string[];
  commands: HarnessCommand[];
  behaviorScenarios: string[];
};

const commandOrder = new Map([
  ["typecheck", 0],
  ["test", 1],
  ["harness:generate", 2],
  ["harness:check", 3],
  ["harness:review", 4],
  ["harness:audit", 5],
  ["harness:behavior", 6],
  ["harness:inferential-review", 7],
  ["harness:runtime-trends", 8],
  ["harness:scorecard", 9],
  ["harness:janitor", 10],
]);

function matchesPrefix(file: string, prefix: string): boolean {
  return file === prefix || file.startsWith(`${prefix}/`);
}

export async function selectValidationsForFiles(files: string[]): Promise<ValidationSelection> {
  const commands = new Map<string, HarnessCommand>();
  const behaviorScenarios = new Set<string>();

  for (const file of files) {
    for (const target of harnessTargets) {
      for (const surface of target.validationSurfaces) {
        if (!surface.pathPrefixes.some((prefix) => matchesPrefix(file, prefix))) {
          continue;
        }

        for (const command of surface.commands) {
          commands.set(command.script, command);
        }

        for (const scenario of surface.behaviorScenarios ?? []) {
          behaviorScenarios.add(scenario);
        }
      }
    }
  }

  return {
    touchedFiles: [...files],
    commands: [...commands.values()].sort((left, right) => {
      const leftOrder = commandOrder.get(left.script) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = commandOrder.get(right.script) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.script.localeCompare(right.script);
    }),
    behaviorScenarios: [...behaviorScenarios].sort(),
  };
}
