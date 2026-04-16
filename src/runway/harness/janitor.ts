import { generateHarnessArtifacts } from "./generate.js";
import { runHarnessCheck } from "./check.js";

export type JanitorResult = {
  regeneratedOutputs: string[];
  checkedPaths: string[];
};

export async function runJanitor(): Promise<JanitorResult> {
  const regeneratedOutputs = await generateHarnessArtifacts();
  const check = await runHarnessCheck();

  if (!check.ok) {
    throw new Error(check.errors.join("\n"));
  }

  return {
    regeneratedOutputs,
    checkedPaths: check.checkedPaths,
  };
}
