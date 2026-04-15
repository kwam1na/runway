import { describe, expect, it } from "vitest";
import { generateHarnessArtifacts } from "../../src/runway/harness/generate.js";

describe("harness generation", () => {
  it("emits the generated docs and validation map", async () => {
    const outputs = await generateHarnessArtifacts();
    expect(outputs).toContain("docs/agent/entry-index.md");
    expect(outputs).toContain("docs/agent/validation-map.json");
    expect(outputs).toContain("graphify-out/index.md");
  });
});
