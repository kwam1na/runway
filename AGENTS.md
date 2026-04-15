# AGENTS.md

## Start here

Read `docs/agent/index.md` before scanning source files.

## Navigation

- Current onboarding docs live in `docs/agent/`
- CLI command surface lives in `src/runway/cli.ts`
- `graphify-out/` is generated later by `npm run harness:generate`
- Regeneration with `npm run harness:generate` is scaffolded through the CLI surface and will fill `graphify-out/` once generation lands

## Validation

These validation commands are available through the scaffolded CLI surface as stubbed placeholders that return `stub:*` with exit code `0`.

- `npm run harness:check`
- `npm run harness:audit`
- `npm run harness:behavior`
- `npm run validate:pr`
