import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { harnessTargets } from "./app-registry.js";
import { behaviorScenarios } from "../scenarios/inventory.js";

async function writeText(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

export type GeneratedArtifact = {
  path: string;
  contents: string;
};

function bullet(items: readonly string[]): string {
  return items.map((item) => `- \`${item}\``).join("\n");
}

function renderGraphIndex(): string {
  const targets = harnessTargets
    .map(
      (target) =>
        `## ${target.label}\n\n- Repo path: \`${target.repoPath}\`\n- Archetype: \`${target.archetype}\`\n- Audited roots:\n${bullet(
          target.auditedRoots,
        )}`,
    )
    .join("\n\n");

  return `# Generated Graph Index

This file is generated from the harness registry.

${targets}
`;
}

function renderEntryIndex(): string {
  const entries = harnessTargets
    .map(
      (target) =>
        `## ${target.label}\n\n- Repo path: \`${target.repoPath}\`\n- Required docs:\n${bullet(
          target.requiredDocs,
        )}`,
    )
    .join("\n\n");

  return `# Generated Entry Index

This file is generated from the harness registry.

${entries}
`;
}

function renderTestIndex(): string {
  const surfaces = harnessTargets
    .flatMap((target) => target.validationSurfaces)
    .map(
      (surface) =>
        `## ${surface.name}\n\n- Path prefixes:\n${bullet(surface.pathPrefixes)}\n- Commands:\n${bullet(
          surface.commands.map((command) => `npm run ${command.script}`),
        )}`,
    )
    .join("\n\n");

  return `# Generated Test Index

This file is generated from the harness registry.

${surfaces}
`;
}

function renderKeyFolderIndex(): string {
  const groups = harnessTargets
    .flatMap((target) => target.keyFolderGroups)
    .map((group) => `## ${group.label}\n\n${bullet(group.paths)}`)
    .join("\n\n");

  return `# Generated Key Folder Index

This file is generated from the harness registry.

${groups}
`;
}

function renderValidationGuide(): string {
  const surfaces = harnessTargets
    .flatMap((target) => target.validationSurfaces)
    .map(
      (surface) =>
        `## ${surface.name}\n\n- Path prefixes:\n${bullet(surface.pathPrefixes)}\n- Commands:\n${bullet(
          surface.commands.map((command) => `npm run ${command.script}`),
        )}\n- Behavior scenarios:\n${
          surface.behaviorScenarios?.length ? bullet(surface.behaviorScenarios) : "- none"
        }`,
    )
    .join("\n\n");

  return `# Generated Validation Guide

This file is generated from the harness registry.

${surfaces}
`;
}

function renderValidationMap(): string {
  return `${JSON.stringify(
    {
      workspace: "runway",
      packageDir: "src/runway",
      targets: harnessTargets,
      behaviorScenarios,
      surfaces: harnessTargets.flatMap((target) => target.validationSurfaces),
    },
    null,
    2,
  )}
`;
}

export function getGeneratedArtifacts(): GeneratedArtifact[] {
  return [
    { path: "graphify-out/index.md", contents: renderGraphIndex() },
    { path: "docs/agent/entry-index.md", contents: renderEntryIndex() },
    { path: "docs/agent/test-index.md", contents: renderTestIndex() },
    { path: "docs/agent/key-folder-index.md", contents: renderKeyFolderIndex() },
    { path: "docs/agent/validation-guide.md", contents: renderValidationGuide() },
    { path: "docs/agent/validation-map.json", contents: renderValidationMap() },
  ];
}

export async function generateHarnessArtifacts(): Promise<string[]> {
  const artifacts = getGeneratedArtifacts();

  for (const artifact of artifacts) {
    await writeText(artifact.path, artifact.contents);
  }

  return artifacts.map((artifact) => artifact.path);
}
