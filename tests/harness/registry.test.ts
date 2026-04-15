import { describe, expect, it } from "vitest";
import { harnessTargets } from "../../src/runway/harness/app-registry.js";
import { behaviorScenarios } from "../../src/runway/scenarios/inventory.js";

describe("registry", () => {
  it("registers runway as the initial harness target", () => {
    expect(harnessTargets).toHaveLength(1);
    expect(harnessTargets[0]).toMatchObject({
      label: "runway",
      repoPath: "src/runway",
      archetype: "library",
    });
  });

  it("defines the bootstrap CLI scenario", () => {
    expect(behaviorScenarios).toContainEqual(
      expect.objectContaining({
        name: "cli-runway-smoke",
        command: ["tsx", "src/runway/cli.ts", "help"],
      }),
    );
  });
});
