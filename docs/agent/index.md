# Runway Agent Index

## Scope

`runway` is currently in a bootstrap state: it ships as a CLI-first TypeScript package shell with built-in harness tooling planned around it.

## Boundaries

- Current source in this checkout lives in `src/runway/index.ts`
- Current manual onboarding docs live in `docs/agent/`
- Generated docs will appear later in `graphify-out/` once harness generation exists

## Planned Later

- `src/runway/cli.ts`
- `src/runway/harness/app-registry.ts`
- `src/runway/scenarios/inventory.ts`

## Common Validations

- `npm run typecheck`
- `npm run test`
- `npm run harness:check`
