import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/runway/cli.js";
import { buildScorecard } from "../../src/runway/harness/scorecard.js";
import { runBehaviorScenarios } from "../../src/runway/harness/behavior.js";

const originalCwd = process.cwd();
const tempDirs: string[] = [];

afterEach(() => {
  process.chdir(originalCwd);
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function inWorkspace(assertions: (workspace: string) => Promise<void>): Promise<void> {
  const tempRoot = mkdtempSync(join(tmpdir(), "runway-runtime-"));
  const workspace = join(tempRoot, "workspace");
  tempDirs.push(tempRoot);
  cpSync(originalCwd, workspace, {
    recursive: true,
    filter(source) {
      const rel = relative(originalCwd, source);
      if (rel === "") return true;

      return rel !== ".git" && !rel.startsWith(".git/") && rel !== "node_modules" && !rel.startsWith("node_modules/");
    },
  });
  process.chdir(workspace);
  await assertions(workspace);
}

describe("runtime tools", () => {
  it("writes a behavior artifact for the bootstrap scenario", async () => {
    await inWorkspace(async (workspace) => {
      const report = await runBehaviorScenarios();

      expect(report.artifactPaths).toContain("artifacts/behavior-cli-runway-smoke.json");

      const artifact = JSON.parse(
        readFileSync(resolve(workspace, "artifacts/behavior-cli-runway-smoke.json"), "utf8"),
      ) as {
        name: string;
        status: string;
      };

      expect(artifact.name).toBe("cli-runway-smoke");
      expect(artifact.status).toBe("passed");
    });
  });

  it("summarizes the current harness state in the scorecard", async () => {
    await inWorkspace(async () => {
      const scorecard = await buildScorecard();

      expect(scorecard).toContain("Harness Scorecard");
      expect(scorecard).toContain("Scenario count: 1");
      expect(scorecard).toContain("cli-runway-smoke");
    });
  });

  it("wires behavior, runtime-trends, scorecard, inferential-review, and janitor through the CLI", async () => {
    await inWorkspace(async (workspace) => {
      const behavior = await runCli(["behavior"]);
      expect(behavior.exitCode).toBe(0);
      expect(behavior.stdout).toContain("behavior-cli-runway-smoke.json");

      const runtimeTrends = await runCli(["runtime-trends"]);
      expect(runtimeTrends.exitCode).toBe(0);
      expect(runtimeTrends.stdout).toContain("cli-runway-smoke");

      const scorecard = await runCli(["scorecard"]);
      expect(scorecard.exitCode).toBe(0);
      expect(scorecard.stdout).toContain("Harness Scorecard");

      const inferentialReview = await runCli(["inferential-review"]);
      expect(inferentialReview.exitCode).toBe(0);
      expect(inferentialReview.stdout).toContain("deterministic");

      rmSync(resolve(workspace, "docs/agent/entry-index.md"));

      const janitor = await runCli(["janitor"]);
      expect(janitor.exitCode).toBe(0);
      expect(janitor.stdout).toContain("docs/agent/entry-index.md");
      expect(readFileSync(resolve(workspace, "docs/agent/entry-index.md"), "utf8")).toContain("Generated Entry Index");
    });
  });
});
