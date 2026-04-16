import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("project skeleton", () => {
  it("defines the Node and TypeScript bootstrap files", () => {
    const root = resolve(process.cwd());
    expect(existsSync(resolve(root, "package.json"))).toBe(true);
    expect(existsSync(resolve(root, "tsconfig.json"))).toBe(true);
    expect(existsSync(resolve(root, "src/runway/index.ts"))).toBe(true);
  });

  it("declares the expected npm scripts", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts).toMatchObject({
      build: "tsc -p tsconfig.json",
      typecheck: "tsc -p tsconfig.json --noEmit",
      test: "vitest run",
      prepare: "husky",
      "validate:commit": "npm run typecheck && npm test && npm run harness:check",
      "validate:push": "npm run validate:pr",
      "harness:generate": "tsx src/runway/cli.ts generate",
      "harness:check": "tsx src/runway/cli.ts check",
    });
  });

  it("defines versioned git hooks for commit and push validation", () => {
    const root = resolve(process.cwd());
    const preCommitPath = resolve(root, ".husky/pre-commit");
    const prePushPath = resolve(root, ".husky/pre-push");

    expect(existsSync(preCommitPath)).toBe(true);
    expect(existsSync(prePushPath)).toBe(true);
    expect(readFileSync(preCommitPath, "utf8")).toContain("npm run validate:commit");
    expect(readFileSync(prePushPath, "utf8")).toContain("npm run validate:push");
  });
});
