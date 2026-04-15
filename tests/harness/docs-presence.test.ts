import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("agent docs", () => {
  it("provides the root and local onboarding docs", () => {
    const agents = readFileSync(resolve(process.cwd(), "AGENTS.md"), "utf8");
    const index = readFileSync(resolve(process.cwd(), "docs/agent/index.md"), "utf8");
    const architecture = readFileSync(resolve(process.cwd(), "docs/agent/architecture.md"), "utf8");
    const testing = readFileSync(resolve(process.cwd(), "docs/agent/testing.md"), "utf8");
    const codeMap = readFileSync(resolve(process.cwd(), "docs/agent/code-map.md"), "utf8");

    expect(agents).toContain("Start here");
    expect(agents).toContain("docs/agent/index.md");
    expect(index).toContain("Scope");
    expect(architecture).toContain("Entrypoints");
    expect(testing).toContain("Validation Ladder");
    expect(codeMap).toContain("Key Folders");
  });
});
