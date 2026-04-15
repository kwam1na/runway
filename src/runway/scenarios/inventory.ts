import type { BehaviorScenario } from "../harness/types.js";

export const behaviorScenarios = [
  {
    name: "cli-runway-smoke",
    description: "Loads the runway CLI and prints the available command set.",
    command: ["tsx", "src/runway/cli.ts", "help"],
    artifactPath: "artifacts/behavior-cli-runway-smoke.json",
  },
] as const satisfies readonly BehaviorScenario[];
