import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/runway/cli.js";
import { harnessTargets } from "../../src/runway/harness/app-registry.js";

const originalCwd = process.cwd();
const tempDirs: string[] = [];

afterEach(() => {
  process.chdir(originalCwd);
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function inWorkspace(assertions: (workspace: string) => Promise<void>): Promise<void> {
  const tempRoot = mkdtempSync(join(tmpdir(), "runway-harness-"));
  const workspace = join(tempRoot, "workspace");
  tempDirs.push(tempRoot);
  cpSync(originalCwd, workspace, {
    recursive: true,
    filter(source) {
      const rel = relative(originalCwd, source);
      if (rel === "") return true;

      return rel !== ".git" &&
        !rel.startsWith(".git/") &&
        rel !== ".worktrees" &&
        !rel.startsWith(".worktrees/") &&
        rel !== "artifacts" &&
        !rel.startsWith("artifacts/") &&
        rel !== "node_modules" &&
        !rel.startsWith("node_modules/");
    },
  });
  process.chdir(workspace);
  await assertions(workspace);
}

describe("harness command behavior", () => {
  it("generates registry-backed artifacts instead of placeholder headers", async () => {
    await inWorkspace(async (workspace) => {
      const result = await runCli(["generate"]);
      expect(result.exitCode).toBe(0);

      const payload = JSON.parse(result.stdout) as {
        command: string;
        outputs: string[];
      };

      expect(payload.command).toBe("generate");
      expect(payload.outputs).toContain("graphify-out/index.md");
      expect(payload.outputs).toContain("docs/agent/validation-map.json");

      expect(readFileSync(resolve(workspace, "graphify-out/index.md"), "utf8")).toContain("runway");
      expect(readFileSync(resolve(workspace, "docs/agent/entry-index.md"), "utf8")).toContain("src/runway");
      expect(readFileSync(resolve(workspace, "docs/agent/key-folder-index.md"), "utf8")).toContain(
        "CLI entrypoints",
      );
      expect(readFileSync(resolve(workspace, "docs/agent/validation-guide.md"), "utf8")).toContain(
        "cli and harness logic",
      );

      const validationMap = JSON.parse(
        readFileSync(resolve(workspace, "docs/agent/validation-map.json"), "utf8"),
      ) as {
        surfaces: Array<{
          name: string;
          pathPrefixes: string[];
        }>;
      };

      expect(validationMap.surfaces).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "cli and harness logic" }),
          expect.objectContaining({ name: "generated docs" }),
          expect.objectContaining({ name: "tests" }),
        ]),
      );
    });
  });

  it("selects the smallest deterministic validation set for touched files", async () => {
    await inWorkspace(async () => {
      const result = await runCli(["review", "src/runway/cli.ts"]);
      expect(result.exitCode).toBe(0);

      const payload = JSON.parse(result.stdout) as {
        scripts: string[];
        touchedFiles: string[];
      };

      expect(payload.touchedFiles).toEqual(["src/runway/cli.ts"]);
      expect(payload.scripts).toEqual(["typecheck", "test"]);
    });
  });

  it("orders regeneration ahead of freshness checks for docs changes", async () => {
    await inWorkspace(async () => {
      const result = await runCli(["review", "docs/agent/index.md"]);
      expect(result.exitCode).toBe(0);

      const payload = JSON.parse(result.stdout) as {
        scripts: string[];
        touchedFiles: string[];
      };

      expect(payload.touchedFiles).toEqual(["docs/agent/index.md"]);
      expect(payload.scripts).toEqual(["test", "harness:generate", "harness:check"]);
    });
  });

  it("includes regeneration and freshness checks for generator inputs", async () => {
    await inWorkspace(async () => {
      const result = await runCli(["review", "src/runway/harness/generate.ts"]);
      expect(result.exitCode).toBe(0);

      const payload = JSON.parse(result.stdout) as {
        scripts: string[];
        touchedFiles: string[];
      };

      expect(payload.touchedFiles).toEqual(["src/runway/harness/generate.ts"]);
      expect(payload.scripts).toEqual(["typecheck", "test", "harness:generate", "harness:check"]);
    });
  });

  it("fails check when a required generated artifact is missing", async () => {
    await inWorkspace(async (workspace) => {
      const generateResult = await runCli(["generate"]);
      expect(generateResult.exitCode).toBe(0);

      rmSync(resolve(workspace, "docs/agent/entry-index.md"));

      const result = await runCli(["check"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("docs/agent/entry-index.md");
      expect(result.stderr).toContain("missing");
    });
  });

  it("fails audit when an audited file has no validation coverage", async () => {
    await inWorkspace(async (workspace) => {
      writeFileSync(resolve(workspace, "src/runway/uncovered.ts"), "export const uncovered = true;\n", "utf8");

      const result = await runCli(["audit"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Uncovered files");
      expect(result.stderr).toContain("src/runway/uncovered.ts");
    });
  });

  it("fails audit when graph output contains uncovered files", async () => {
    await inWorkspace(async (workspace) => {
      const generateResult = await runCli(["generate"]);
      expect(generateResult.exitCode).toBe(0);

      writeFileSync(resolve(workspace, "graphify-out/uncovered.md"), "# stray graph output\n", "utf8");

      const result = await runCli(["audit"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("graphify-out/uncovered.md");
    });
  });

  it("fails audit when required graph output is missing", async () => {
    await inWorkspace(async (workspace) => {
      const generateResult = await runCli(["generate"]);
      expect(generateResult.exitCode).toBe(0);

      rmSync(resolve(workspace, "graphify-out"), { recursive: true, force: true });

      const result = await runCli(["audit"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("graphify-out/index.md");
      expect(result.stderr).toContain("Missing generated artifact");
    });
  });

  it("fails audit in candidate mode when a requested file is missing", async () => {
    await inWorkspace(async (workspace) => {
      const generateResult = await runCli(["generate"]);
      expect(generateResult.exitCode).toBe(0);

      rmSync(resolve(workspace, "graphify-out/index.md"));

      const result = await runCli(["audit", "graphify-out/index.md"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("graphify-out/index.md");
      expect(result.stderr).toContain("Missing candidate file");
    });
  });

  it("fails audit when a generated artifact loses validation-surface coverage", async () => {
    await inWorkspace(async () => {
      const generatedDocsSurface = harnessTargets[0].validationSurfaces.find(
        (surface) => surface.name === "generated docs",
      );
      expect(generatedDocsSurface).toBeDefined();

      const originalPrefixes = [...generatedDocsSurface!.pathPrefixes];

      try {
        ((generatedDocsSurface!.pathPrefixes as unknown) as string[]).splice(
          originalPrefixes.indexOf("docs/agent/entry-index.md"),
          1,
        );

        const result = await runCli(["audit", "docs/agent/entry-index.md"]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("docs/agent/entry-index.md");
        expect(result.stderr).toContain("Validation surface coverage missing");
      } finally {
        ((generatedDocsSurface!.pathPrefixes as unknown) as string[]).splice(
          0,
          generatedDocsSurface!.pathPrefixes.length,
          ...originalPrefixes,
        );
      }
    });
  });

  it("fails audit when a declared covered file is deleted", async () => {
    await inWorkspace(async (workspace) => {
      rmSync(resolve(workspace, "src/runway/harness/review.ts"));

      const result = await runCli(["audit"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("src/runway/harness/review.ts");
      expect(result.stderr).toContain("Missing validation surface path");
    });
  });
});
