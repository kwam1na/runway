import { describe, expect, it } from "vitest";
import { harnessTargets } from "../../src/runway/harness/app-registry.js";
import { behaviorScenarios } from "../../src/runway/scenarios/inventory.js";

describe("registry", () => {
  it("keeps the registry internally consistent", () => {
    const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;

    expect(unique(harnessTargets.map((target) => target.label))).toBe(true);
    expect(unique(behaviorScenarios.map((scenario) => scenario.name))).toBe(true);

    const scenarioNames = new Set(behaviorScenarios.map((scenario) => scenario.name));

    for (const target of harnessTargets) {
      expect(target.label).not.toHaveLength(0);
      expect(target.repoPath).not.toHaveLength(0);
      expect(target.auditedRoots.length).toBeGreaterThan(0);
      expect(target.requiredDocs.length).toBeGreaterThan(0);
      expect(target.keyFolderGroups.length).toBeGreaterThan(0);
      expect(target.validationSurfaces.length).toBeGreaterThan(0);

      for (const root of target.auditedRoots) {
        expect(root).not.toHaveLength(0);
      }

      for (const doc of target.requiredDocs) {
        expect(doc).not.toHaveLength(0);
      }

      for (const group of target.keyFolderGroups) {
        expect(group.label).not.toHaveLength(0);
        expect(group.paths.length).toBeGreaterThan(0);

        for (const path of group.paths) {
          expect(path).not.toHaveLength(0);
        }
      }

      for (const surface of target.validationSurfaces) {
        expect(surface.name).not.toHaveLength(0);
        expect(surface.pathPrefixes.length).toBeGreaterThan(0);
        expect(surface.commands.length).toBeGreaterThan(0);

        for (const prefix of surface.pathPrefixes) {
          expect(prefix).not.toHaveLength(0);
        }

        for (const command of surface.commands) {
          expect(command.kind).toBe("npm");
          expect(command.script).not.toHaveLength(0);
        }

        for (const scenarioName of surface.behaviorScenarios ?? []) {
          expect(scenarioNames.has(scenarioName)).toBe(true);
        }
      }
    }
  });

  it("registers runway as the initial harness target", () => {
    expect(harnessTargets).toHaveLength(1);
    expect(harnessTargets[0]).toMatchObject({
      label: "runway",
      repoPath: "src/runway",
      archetype: "library",
    });
    expect(harnessTargets[0].keyFolderGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "interactive assist",
          paths: ["src/runway/interactive-assist.ts"],
        }),
      ]),
    );
    expect(harnessTargets[0].validationSurfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "interactive assist logic",
          pathPrefixes: ["src/runway/interactive-assist.ts"],
        }),
      ]),
    );
  });

  it("defines the bootstrap CLI scenario", () => {
    expect(behaviorScenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "cli-runway-smoke",
          command: ["tsx", "src/runway/cli.ts", "help"],
          artifactPath: "artifacts/behavior-cli-runway-smoke.json",
        }),
        expect.objectContaining({
          name: "cli-runway-assist",
          command: [
            "tsx",
            "src/runway/cli.ts",
            "assist",
            "src/runway/scenarios/fixtures/assist-partial-profile.json",
            "src/runway/scenarios/fixtures/assist-answer-patch.json",
          ],
          artifactPath: "artifacts/behavior-cli-runway-assist.json",
        }),
      ]),
    );
  });
});
