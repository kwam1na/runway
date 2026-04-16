import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runCli } from "../../src/runway/cli.js";

describe("ci workflow", () => {
  it("runs the required harness steps", () => {
    const root = process.cwd();
    const workflow = readFileSync(resolve(root, ".github/workflows/harness.yml"), "utf8");
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(workflow).toContain("actions/checkout@v4");
    expect(workflow).toContain("actions/setup-node@v4");
    expect(workflow).toContain("npm install --package-lock=false");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm run test");
    expect(workflow).toContain("npm run harness:generate");
    expect(workflow).toContain("npm run harness:check");
    expect(workflow).toContain("npm run harness:behavior");
    expect(workflow).toContain("npm run harness:audit -- src/runway/cli.ts");
    expect(workflow).toContain("npm run harness:inferential-review");
    expect(workflow).toContain("npm run harness:scorecard");
    expect(workflow).toContain("actions/upload-artifact@v4");

    expect(packageJson.scripts?.["ci:harness"]).toBe(
      "npm run typecheck && npm run test && npm run harness:generate && npm run harness:check && npm run harness:behavior && npm run harness:audit -- src/runway/cli.ts && npm run harness:inferential-review && npm run harness:scorecard",
    );
    expect(packageJson.scripts?.["validate:pr"]).toBe(
      "npm run typecheck && npm run test && npm run harness:check && npm run harness:behavior && npm run harness:audit && npm run harness:inferential-review && npm run harness:scorecard",
    );
  });

  it("selects the ci harness validation for the workflow file", async () => {
    const result = await runCli(["review", ".github/workflows/harness.yml"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"scripts":["ci:harness"]');
  });
});
