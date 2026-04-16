import type { BehaviorScenario } from "../harness/types.js";

export const behaviorScenarios = [
  {
    name: "cli-runway-smoke",
    description: "Loads the runway CLI and prints the available command set.",
    command: ["tsx", "src/runway/cli.ts", "help"],
    artifactPath: "artifacts/behavior-cli-runway-smoke.json",
  },
  {
    name: "cli-runway-assist",
    description: "Runs the minimal agent loop against a partial profile and local answer patch.",
    command: [
      "tsx",
      "src/runway/cli.ts",
      "assist",
      "src/runway/scenarios/fixtures/assist-partial-profile.json",
      "src/runway/scenarios/fixtures/assist-answer-patch.json",
    ],
    artifactPath: "artifacts/behavior-cli-runway-assist.json",
  },
] as const satisfies readonly BehaviorScenario[];
