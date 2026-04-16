import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/runway/cli.js";

const originalCwd = process.cwd();
const tempDirs: string[] = [];

afterEach(() => {
  process.chdir(originalCwd);
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function inWorkspace(assertions: (workspace: string) => Promise<void>): Promise<void> {
  const tempRoot = mkdtempSync(join(tmpdir(), "runway-bootstrap-"));
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

describe("bootstrap flow", () => {
  it("runs generate, check, and behavior through the CLI and documents the supported operator flow", async () => {
    await inWorkspace(async (workspace) => {
      const generate = await runCli(["generate"]);
      expect(generate.exitCode).toBe(0);
      expect(generate.stdout).toContain("\"command\":\"generate\"");
      expect(generate.stdout).toContain("graphify-out/index.md");

      const check = await runCli(["check"]);
      expect(check.exitCode).toBe(0);
      expect(check.stdout).toContain("\"command\":\"check\"");
      expect(check.stdout).toContain("docs/agent/entry-index.md");

      const behavior = await runCli(["behavior"]);
      expect(behavior.exitCode).toBe(0);
      expect(behavior.stdout).toContain("\"command\":\"behavior\"");
      expect(behavior.stdout).toContain("behavior-cli-runway-smoke.json");

      const readme = readFileSync(resolve(workspace, "README.md"), "utf8");
      expect(readme).toContain("npm run harness:generate");
      expect(readme).toContain("npm run harness:check");
      expect(readme).toContain("npm run harness:behavior");
      expect(readme).toContain("npm run harness:audit");
    });
  });
});
