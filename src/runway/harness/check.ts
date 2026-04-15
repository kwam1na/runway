import { readFile } from "node:fs/promises";
import { harnessTargets } from "./app-registry.js";
import { getGeneratedArtifacts } from "./generate.js";

export type HarnessCheckResult = {
  ok: boolean;
  errors: string[];
  checkedPaths: string[];
};

export async function runHarnessCheck(): Promise<HarnessCheckResult> {
  const errors: string[] = [];
  const checkedPaths = new Set<string>();

  for (const target of harnessTargets) {
    for (const path of target.requiredDocs) {
      checkedPaths.add(path);
      try {
        await readFile(path, "utf8");
      } catch {
        errors.push(`Missing required path: ${path}`);
      }
    }
  }

  for (const artifact of getGeneratedArtifacts()) {
    checkedPaths.add(artifact.path);
    try {
      const actual = await readFile(artifact.path, "utf8");
      if (actual !== artifact.contents) {
        errors.push(`generated artifact is stale: ${artifact.path}`);
      }
    } catch {
      errors.push(`missing generated artifact: ${artifact.path}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    checkedPaths: [...checkedPaths].sort(),
  };
}
