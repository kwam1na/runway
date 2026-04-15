import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("agent docs", () => {
  it("provides the root and local onboarding docs", () => {
    const root = process.cwd();
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const agents = readFileSync(resolve(root, "AGENTS.md"), "utf8");
    const index = readFileSync(resolve(root, "docs/agent/index.md"), "utf8");
    const architecture = readFileSync(resolve(root, "docs/agent/architecture.md"), "utf8");
    const testing = readFileSync(resolve(root, "docs/agent/testing.md"), "utf8");
    const codeMap = readFileSync(resolve(root, "docs/agent/code-map.md"), "utf8");
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const cliExists = existsSync(resolve(root, "src/runway/cli.ts"));
    const scripts = packageJson.scripts ?? {};

    expect(cliExists).toBe(false);
    expect(scripts["harness:generate"]).toBe("tsx src/runway/cli.ts generate");
    expect(scripts["harness:check"]).toBe("tsx src/runway/cli.ts check");
    expect(scripts["harness:audit"]).toBe("tsx src/runway/cli.ts audit");
    expect(scripts["validate:pr"]).toBe(
      "npm run typecheck && npm run test && npm run harness:check && npm run harness:audit && npm run harness:inferential-review && npm run harness:scorecard",
    );

    expect(readme).toContain("Harness Commands");
    expect(readme).toContain("planned for the next bootstrap tasks");
    expect(readme).toContain("not usable yet");
    expect(readme).toContain("npm run harness:generate");
    expect(readme).toContain("npm run harness:check");
    expect(readme).toContain("npm run harness:audit");
    expect(readme).toContain("npm run validate:pr");

    expect(agents).toContain("Start here");
    expect(agents).toContain("docs/agent/index.md");
    expect(agents).toContain("generated later");
    expect(agents).toContain("planned for the next bootstrap tasks");
    expect(agents).toContain("not available yet");
    expect(agents).toContain("npm run harness:check");
    expect(agents).toContain("npm run harness:audit");
    expect(agents).toContain("npm run harness:behavior");
    expect(agents).toContain("npm run validate:pr");

    const indexSections = index.split("\n## Planned Later\n");
    const architectureSections = architecture.split("\n## Planned Later\n");
    const codeMapSections = codeMap.split("\n## Planned Later\n");
    const testingSections = testing.split("\n## Manual Extras\n");

    const readmeAvailabilityLine = "These are planned for the next bootstrap tasks and are not usable yet in this checkout because `src/runway/cli.ts` does not exist.";
    const agentsAvailabilityLine = "These validation commands are planned for the next bootstrap tasks and are not available yet in this checkout because `src/runway/cli.ts` does not exist.";

    expect(index).toContain("Scope");
    expect(index).toContain("Current manual onboarding docs");
    expect(index).toContain("Generated docs will appear later in `graphify-out/`");
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

    expect(readme).toContain(readmeAvailabilityLine);
    expect(readme).not.toContain("Harness Commands\n\n- `npm run harness:generate`");
    expect(agents).toContain(agentsAvailabilityLine);
    expect(agents).not.toContain("Validation\n\n- `npm run harness:check`");
    expect(readme).toContain(
      cliExists
        ? "are usable now"
        : "are planned for the next bootstrap tasks and are not usable yet in this checkout because `src/runway/cli.ts` does not exist.",
    );
    expect(agents).toContain(
      cliExists
        ? "available now"
        : "are planned for the next bootstrap tasks and are not available yet in this checkout because `src/runway/cli.ts` does not exist.",
    );
  });
});
