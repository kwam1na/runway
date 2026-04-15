import type { HarnessTarget } from "./types.js";

export const harnessTargets = [
  {
    label: "runway",
    repoPath: "src/runway",
    archetype: "library",
    onboardingStatus: "active",
    auditedRoots: ["src/runway", "docs/agent", "tests", ".github/workflows"],
    requiredDocs: [
      "docs/agent/index.md",
      "docs/agent/architecture.md",
      "docs/agent/testing.md",
      "docs/agent/code-map.md",
    ],
    keyFolderGroups: [
      { label: "CLI entrypoints", paths: ["src/runway/cli.ts"] },
      { label: "finance domain logic", paths: ["src/runway/finance"] },
      { label: "agent workflows", paths: ["src/runway/agents"] },
      { label: "harness logic", paths: ["src/runway/harness"] },
      { label: "scenario definitions", paths: ["src/runway/scenarios"] },
    ],
    validationSurfaces: [
      {
        name: "cli and harness logic",
        pathPrefixes: ["src/runway/cli.ts", "src/runway/harness"],
        commands: [
          { kind: "npm", script: "typecheck" },
          { kind: "npm", script: "test" },
        ],
        behaviorScenarios: ["cli-runway-smoke"],
      },
    ],
  },
] as const satisfies readonly HarnessTarget[];
