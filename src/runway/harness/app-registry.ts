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
      "docs/agent/analysis-workflow.md",
      "docs/agent/architecture.md",
      "docs/agent/testing.md",
      "docs/agent/code-map.md",
    ],
    keyFolderGroups: [
      { label: "CLI entrypoints", paths: ["src/runway/cli.ts"] },
      { label: "interactive assist", paths: ["src/runway/interactive-assist.ts"] },
      { label: "statement ingestion", paths: ["src/runway/statement-intake"] },
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
        behaviorScenarios: ["cli-runway-smoke", "cli-runway-assist"],
      },
      {
        name: "agent workflow logic",
        pathPrefixes: ["src/runway/agents"],
        commands: [
          { kind: "npm", script: "typecheck" },
          { kind: "npm", script: "test" },
        ],
        behaviorScenarios: ["cli-runway-assist"],
      },
      {
        name: "interactive assist logic",
        pathPrefixes: ["src/runway/interactive-assist.ts"],
        commands: [
          { kind: "npm", script: "typecheck" },
          { kind: "npm", script: "test" },
        ],
        behaviorScenarios: ["cli-runway-assist"],
      },
      {
        name: "statement ingestion logic",
        pathPrefixes: ["src/runway/statement-intake"],
        commands: [
          { kind: "npm", script: "typecheck" },
          { kind: "npm", script: "test" },
        ],
        behaviorScenarios: [],
      },
      {
        name: "cli and harness logic",
        pathPrefixes: [
          "src/runway/harness/app-registry.ts",
          "src/runway/harness/audit.ts",
          "src/runway/harness/behavior.ts",
          "src/runway/harness/check.ts",
          "src/runway/harness/command-runner.ts",
          "src/runway/harness/generate.ts",
          "src/runway/harness/inferential-review.ts",
          "src/runway/harness/janitor.ts",
          "src/runway/harness/review.ts",
          "src/runway/harness/runtime-trends.ts",
          "src/runway/harness/scorecard.ts",
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
        name: "finance domain logic",
        pathPrefixes: ["src/runway/finance"],
        commands: [
          { kind: "npm", script: "typecheck" },
          { kind: "npm", script: "test" },
        ],
        behaviorScenarios: [],
      },
      {
        name: "harness workflow",
        pathPrefixes: [".github/workflows/harness.yml"],
        commands: [{ kind: "npm", script: "ci:harness" }],
        behaviorScenarios: [],
      },
      {
        name: "scenario inventory",
        pathPrefixes: ["src/runway/scenarios"],
        commands: [
          { kind: "npm", script: "typecheck" },
          { kind: "npm", script: "test" },
          { kind: "npm", script: "harness:generate" },
          { kind: "npm", script: "harness:check" },
        ],
        behaviorScenarios: ["cli-runway-smoke", "cli-runway-assist"],
      },
      {
        name: "manual docs",
        pathPrefixes: [
          "README.md",
          "AGENTS.md",
          "docs/agent/index.md",
          "docs/agent/analysis-workflow.md",
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
