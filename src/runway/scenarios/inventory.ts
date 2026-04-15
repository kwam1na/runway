import type { BehaviorScenario } from "../harness/types.js";

export const behaviorScenarios: BehaviorScenario[] = [
  {
    name: "cli-runway-smoke",
    description: "Loads the runway CLI and prints the available command set.",
    command: ["tsx", "src/runway/cli.ts", "help"],
    artifactPath: "artifacts/behavior-cli-runway-smoke.json",
  },
];
