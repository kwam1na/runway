import { behaviorScenarios } from "../scenarios/inventory.js";
import { harnessTargets } from "./app-registry.js";

export async function buildScorecard(): Promise<string> {
  return [
    "# Harness Scorecard",
    "",
    `Target count: ${harnessTargets.length}`,
    `Scenario count: ${behaviorScenarios.length}`,
    `Scenarios: ${behaviorScenarios.map((scenario) => scenario.name).join(", ")}`,
  ].join("\n");
}
