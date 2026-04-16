import { runHarnessCheck } from "./check.js";

export async function runInferentialReview(): Promise<string> {
  const check = await runHarnessCheck();

  return [
    "# Inferential Review",
    "",
    `Mode: deterministic`,
    `Check status: ${check.ok ? "clean" : "needs-attention"}`,
  ].join("\n");
}
