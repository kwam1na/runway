import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runCli } from "../../src/runway/cli.js";

describe("agent docs", () => {
  it("describes the real harness command surface", async () => {
    const root = process.cwd();
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const agents = readFileSync(resolve(root, "AGENTS.md"), "utf8");
    const index = readFileSync(resolve(root, "docs/agent/index.md"), "utf8");
    const architecture = readFileSync(resolve(root, "docs/agent/architecture.md"), "utf8");
    const analysisWorkflow = readFileSync(resolve(root, "docs/agent/analysis-workflow.md"), "utf8");
    const testing = readFileSync(resolve(root, "docs/agent/testing.md"), "utf8");
    const codeMap = readFileSync(resolve(root, "docs/agent/code-map.md"), "utf8");
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(existsSync(resolve(root, "src/runway/cli.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src/runway/interactive-assist.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src/runway/index.ts"))).toBe(true);
    expect(existsSync(resolve(root, "docs/agent"))).toBe(true);
    expect(existsSync(resolve(root, "docs/agent/analysis-workflow.md"))).toBe(true);
    expect(existsSync(resolve(root, "src/runway/agents"))).toBe(true);
    expect(existsSync(resolve(root, "src/runway/harness/app-registry.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src/runway/scenarios/inventory.ts"))).toBe(true);
    expect(existsSync(resolve(root, "graphify-out"))).toBe(true);

    const scripts = packageJson.scripts ?? {};
    expect(scripts["harness:generate"]).toBe("tsx src/runway/cli.ts generate");
    expect(scripts["harness:check"]).toBe("tsx src/runway/cli.ts check");
    expect(scripts["harness:review"]).toBe("tsx src/runway/cli.ts review");
    expect(scripts["harness:audit"]).toBe("tsx src/runway/cli.ts audit");

    const generateResult = await runCli(["generate"]);
    const checkResult = await runCli(["check"]);
    const auditResult = await runCli(["audit"]);
    const helpResult = await runCli(["help"]);

    expect(helpResult.exitCode).toBe(0);
    expect(helpResult.stdout).toContain("assist");
    expect(helpResult.stdout).toContain("generate");
    expect(helpResult.stdout).toContain("check");
    expect(helpResult.stdout).toContain("review");
    expect(helpResult.stdout).toContain("audit");
    expect(generateResult.exitCode).toBe(0);
    expect(checkResult.exitCode).toBe(0);
    expect(auditResult.exitCode).toBe(0);
    expect(generateResult.stdout).toContain("\"command\":\"generate\"");
    expect(checkResult.stdout).toContain("\"command\":\"check\"");
    expect(auditResult.stdout).toContain("\"command\":\"audit\"");

    expect(readme).toContain("Harness Commands");
    expect(readme).toContain("npm run harness:generate");
    expect(readme).toContain("npm run harness:check");
    expect(readme).toContain("npm run harness:behavior");
    expect(readme).toContain("npm run harness:review");
    expect(readme).toContain("npm run harness:audit");
    expect(readme).toContain("npm run validate:pr");
    expect(readme).toContain("docs/agent/analysis-workflow.md");
    expect(readme).not.toContain("stub:*");

    expect(agents).toContain("Start here");
    expect(agents).toContain("docs/agent/index.md");
    expect(agents).toContain("CLI command surface lives in `src/runway/cli.ts`");
    expect(agents).toContain("graphify-out/");
    expect(agents).toContain("npm run harness:check");
    expect(agents).toContain("npm run harness:review");
    expect(agents).toContain("npm run harness:audit");
    expect(agents).toContain("npm run validate:pr");
    expect(agents).not.toContain("stub:*");

    expect(index).toContain("## Scope");
    expect(index).toContain("## Boundaries");
    expect(index).toContain("## Common Validations");
    expect(index).toContain("src/runway/cli.ts");
    expect(index).toContain("docs/agent/analysis-workflow.md");
    expect(index).toContain("analyze");
    expect(index).toContain("assist");
    expect(index).toContain("interactive TTY");
    expect(index).toContain("src/runway/agents");
    expect(index).toContain("src/runway/harness/app-registry.ts");
    expect(index).toContain("src/runway/scenarios/inventory.ts");
    expect(index).toContain("npm run harness:check");
    expect(index).toContain("npm run harness:review");
    expect(index).not.toContain("stub:check");

    expect(analysisWorkflow).toContain("## Workflow");
    expect(analysisWorkflow).toContain("## Thin Wrapper Pattern");
    expect(analysisWorkflow).toContain("## Boundaries");
    expect(analysisWorkflow).toContain("analyze <profile-path>");
    expect(analysisWorkflow).toContain("assist <profile-path> [answer-patch-path]");
    expect(analysisWorkflow).toContain("Interactive TTY mode");
    expect(analysisWorkflow).toContain("<profile-path>.bak");
    expect(analysisWorkflow).toContain("runAgentWorkflow");
    expect(analysisWorkflow).toContain("mergeFinancialProfilePatch");
    expect(analysisWorkflow).toContain("LocalFinancialProfileInput");
    expect(analysisWorkflow).toContain("normalizeFinancialProfile");
    expect(analysisWorkflow).toContain("analyzeProfilePayload");
    expect(analysisWorkflow).toContain("buildRunwayPlan");
    expect(analysisWorkflow).toContain("available_cash");
    expect(analysisWorkflow).toContain("expected_monthly_income");
    expect(analysisWorkflow).toContain("income_is_confirmed");
    expect(analysisWorkflow).toContain("question");
    expect(analysisWorkflow).toContain("local-only");
    expect(analysisWorkflow).toContain("runway-first");
    expect(analysisWorkflow).toContain("No future income is assumed until it is confirmed.");
    expect(analysisWorkflow).toContain("not financial advice");
    expect(analysisWorkflow).not.toContain("alternate field names");

    expect(architecture).toContain("## Entrypoints");
    expect(architecture).toContain("## Edit Here, Not There");
    expect(architecture).toContain("src/runway/cli.ts");
    expect(architecture).toContain("src/runway/harness/app-registry.ts");
    expect(architecture).toContain("src/runway/scenarios/inventory.ts");

    expect(testing).toContain("## Validation Ladder");
    expect(testing).toContain("## Harness Repair");
    expect(testing).toContain("npm run harness:generate");
    expect(testing).toContain("npm run harness:check");
    expect(testing).toContain("npm run harness:review");
    expect(testing).toContain("npm run harness:audit");
    expect(testing).toContain("npm run harness:behavior");
    expect(testing).toContain("npm run validate:pr");
    expect(testing).toContain("src/runway/interactive-assist.ts");
    expect(testing).not.toContain("stub:*");

    expect(codeMap).toContain("## Key Folders");
    expect(codeMap).toContain("src/runway/index.ts");
    expect(codeMap).toContain("src/runway/cli.ts");
    expect(codeMap).toContain("src/runway/harness/");
    expect(codeMap).toContain("src/runway/scenarios/");
    expect(codeMap).toContain("src/runway/agents/");
    expect(codeMap).toContain("implemented minimal agent loop");
    expect(codeMap).toContain("src/runway/finance/");
    expect(codeMap).toContain("docs/agent/analysis-workflow.md");
    expect(codeMap).toContain("graphify-out/");
  });
});
