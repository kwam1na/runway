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
    expect(agents).toContain("generated later");

    const indexSections = index.split("\n## Planned Later\n");
    const architectureSections = architecture.split("\n## Planned Later\n");
    const codeMapSections = codeMap.split("\n## Planned Later\n");
    const testingSections = testing.split("\n## Manual Extras\n");

    expect(index).toContain("Scope");
    expect(index).toContain("Planned Later");
    expect(index).toContain("src/runway/index.ts");
    expect(index).toContain("graphify-out/");
    expect(index).toContain("src/runway/cli.ts");
    expect(index).toContain("src/runway/harness/app-registry.ts");
    expect(index).toContain("src/runway/scenarios/inventory.ts");
    expect(indexSections[0]).not.toContain("src/runway/cli.ts");
    expect(indexSections[0]).not.toContain("src/runway/harness/app-registry.ts");
    expect(indexSections[0]).not.toContain("src/runway/scenarios/inventory.ts");
    expect(indexSections[1]).toContain("src/runway/cli.ts");
    expect(indexSections[1]).toContain("src/runway/harness/app-registry.ts");
    expect(indexSections[1]).toContain("src/runway/scenarios/inventory.ts");

    expect(architecture).toContain("Entrypoints");
    expect(architecture).toContain("Current bootstrap entrypoint: `src/runway/index.ts`");
    expect(architecture).toContain("Planned Later");
    expect(architecture).toContain("src/runway/cli.ts");
    expect(architecture).toContain("src/runway/harness/app-registry.ts");
    expect(architecture).toContain("src/runway/scenarios/inventory.ts");
    expect(architectureSections[0]).not.toContain("src/runway/cli.ts");
    expect(architectureSections[0]).not.toContain("src/runway/harness/app-registry.ts");
    expect(architectureSections[0]).not.toContain("src/runway/scenarios/inventory.ts");
    expect(architectureSections[1]).toContain("src/runway/cli.ts");
    expect(architectureSections[1]).toContain("src/runway/harness/app-registry.ts");
    expect(architectureSections[1]).toContain("src/runway/scenarios/inventory.ts");

    expect(testing).toContain("Validation Ladder");
    expect(testing).toContain("npm run validate:pr");
    expect(testing).toContain("npm run harness:inferential-review");
    expect(testing).toContain("npm run harness:scorecard");
    expect(testing).toContain("Manual Extras");
    expect(testing).toContain("npm run harness:behavior");
    expect(testing).toContain("extra manual check");
    expect(testingSections[0]).not.toContain("npm run harness:behavior");
    expect(testingSections[1]).toContain("npm run harness:behavior");

    expect(codeMap).toContain("Key Folders");
    expect(codeMap).toContain("Current source lives in `src/runway/index.ts`");
    expect(codeMap).toContain("Planned Later");
    expect(codeMap).toContain("src/runway/cli.ts");
    expect(codeMap).toContain("src/runway/harness/");
    expect(codeMap).toContain("src/runway/scenarios/");
    expect(codeMap).toContain("src/runway/agents/");
    expect(codeMap).toContain("src/runway/finance/");
    expect(codeMapSections[0]).not.toContain("src/runway/cli.ts");
    expect(codeMapSections[0]).not.toContain("src/runway/agents/");
    expect(codeMapSections[0]).not.toContain("src/runway/finance/");
    expect(codeMapSections[1]).toContain("src/runway/cli.ts");
    expect(codeMapSections[1]).toContain("src/runway/agents/");
    expect(codeMapSections[1]).toContain("src/runway/finance/");
  });
});
