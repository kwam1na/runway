# runway

CLI-first TypeScript repository for an agentic personal-finance system.

## Harness Commands

The supported bootstrap flow is:

- `npm run harness:generate`
- `npm run harness:check`
- `npm run harness:behavior`

`generate` refreshes the registry-backed artifacts, `check` verifies the generated outputs, and `behavior` runs the CLI smoke scenario that proves the bootstrap path is wired end to end. Once that baseline is healthy, use `npm run harness:review`, `npm run harness:audit`, and `npm run validate:pr` for the broader validation steps.
