import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateHarnessArtifacts } from "../../src/runway/harness/generate.js";

describe("harness generation", () => {
  it("emits registry-backed generated docs and the validation map", async () => {
    const outputs = await generateHarnessArtifacts();
    expect(outputs).toContain("docs/agent/entry-index.md");
    expect(outputs).toContain("docs/agent/validation-map.json");
    expect(outputs).toContain("graphify-out/index.md");

    const graphIndex = readFileSync(resolve(process.cwd(), "graphify-out/index.md"), "utf8");
    const validationGuide = readFileSync(resolve(process.cwd(), "docs/agent/validation-guide.md"), "utf8");
    expect(graphIndex).toContain("runway");
    expect(graphIndex).toContain("src/runway");
    expect(validationGuide).toContain("cli and harness logic");
  });
});
