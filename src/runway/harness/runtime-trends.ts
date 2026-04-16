import { readFile } from "node:fs/promises";
import { behaviorScenarios } from "../scenarios/inventory.js";

export async function buildRuntimeTrends(): Promise<string> {
  const lines = ["# Runtime Trends", ""];

  for (const scenario of behaviorScenarios) {
    let status = "not-run";

    try {
      const artifact = JSON.parse(await readFile(scenario.artifactPath, "utf8")) as { status?: string };
      status = artifact.status ?? status;
    } catch {
      status = "not-run";
    }

    lines.push(`- ${scenario.name}: ${status}`);
  }

  return `${lines.join("\n")}\n`;
}
