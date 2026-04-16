import type { HarnessTarget } from "./types.js";

export const harnessTargets = [
  {
    label: "runway",
    repoPath: "src/runway",
    archetype: "library",
    onboardingStatus: "active",
    auditedRoots: ["src/runway", "docs/agent", "tests", ".github/workflows", "graphify-out"],
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
        name: "package entrypoints",
        pathPrefixes: ["src/runway/index.ts", "src/runway/cli.ts"],
        commands: [
          { kind: "npm", script: "typecheck" },
          { kind: "npm", script: "test" },
        ],
        behaviorScenarios: ["cli-runway-smoke"],
      },
      {
        name: "cli and harness logic",
        pathPrefixes: [
          "src/runway/harness/app-registry.ts",
          "src/runway/harness/audit.ts",
          "src/runway/harness/check.ts",
          "src/runway/harness/command-runner.ts",
          "src/runway/harness/generate.ts",
          "src/runway/harness/review.ts",
          "src/runway/harness/types.ts",
        ],
        commands: [
          { kind: "npm", script: "typecheck" },
          { kind: "npm", script: "test" },
          { kind: "npm", script: "harness:generate" },
          { kind: "npm", script: "harness:check" },
        ],
        behaviorScenarios: [],
      },
      {
        name: "scenario inventory",
        pathPrefixes: ["src/runway/scenarios/inventory.ts"],
        commands: [
          { kind: "npm", script: "typecheck" },
          { kind: "npm", script: "test" },
          { kind: "npm", script: "harness:generate" },
          { kind: "npm", script: "harness:check" },
        ],
        behaviorScenarios: ["cli-runway-smoke"],
      },
      {
        name: "manual docs",
        pathPrefixes: [
          "README.md",
          "AGENTS.md",
          "docs/agent/index.md",
          "docs/agent/architecture.md",
          "docs/agent/testing.md",
          "docs/agent/code-map.md",
        ],
        commands: [
          { kind: "npm", script: "test" },
          { kind: "npm", script: "harness:generate" },
          { kind: "npm", script: "harness:check" },
        ],
        behaviorScenarios: [],
      },
      {
        name: "generated docs",
        pathPrefixes: [
          "graphify-out/index.md",
          "docs/agent/entry-index.md",
          "docs/agent/test-index.md",
          "docs/agent/key-folder-index.md",
          "docs/agent/validation-guide.md",
          "docs/agent/validation-map.json",
        ],
        commands: [
          { kind: "npm", script: "test" },
          { kind: "npm", script: "harness:generate" },
          { kind: "npm", script: "harness:check" },
        ],
        behaviorScenarios: [],
      },
      {
        name: "tests",
        pathPrefixes: ["tests"],
        commands: [{ kind: "npm", script: "test" }],
        behaviorScenarios: [],
      },
    ],
  },
] as const satisfies readonly HarnessTarget[];
