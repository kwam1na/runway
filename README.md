# runway

CLI-first TypeScript repository for an agentic personal-finance system.

## Analysis Workflow

The shared intake, validation, and recommendation contract for agent integrations lives in `docs/agent/analysis-workflow.md`. Use that doc together with `src/runway/cli.ts analyze <profile-path>` when wiring a new local wrapper to the shared finance runner.

## Harness Commands

The supported bootstrap flow is:

- `npm run harness:generate`
- `npm run harness:check`
- `npm run harness:behavior`

`generate` refreshes the registry-backed artifacts, `check` verifies the generated outputs, and `behavior` runs the CLI smoke scenario that proves the bootstrap path is wired end to end. Once that baseline is healthy, use `npm run harness:review`, `npm run harness:audit`, and `npm run validate:pr` for the broader validation steps.

## Git Hooks

This repo uses Husky-managed Git hooks after `npm install` runs the `prepare` script.

- `pre-commit` runs `npm run validate:commit`
- `pre-push` runs `npm run validate:push`

`validate:commit` is the local commit gate: `typecheck`, `test`, and `harness:check`.
`validate:push` delegates to `npm run validate:pr`, which is the full PR-time validation flow.
