# Runway Agent Index

## Jump Links

- [Scope](#scope)
- [Boundaries](#boundaries)
- [Planned Later](#planned-later)
- [Common Validations](#common-validations)

## Scope

`runway` is currently in a bootstrap state: it ships as a CLI-first TypeScript package shell with a scaffolded command surface.

## Boundaries

- Current source in this checkout lives in `src/runway/index.ts`
- Current CLI surface lives in `src/runway/cli.ts`
- Current manual onboarding docs live in `docs/agent/`
- Generated docs will appear later in `graphify-out/` once harness generation exists

## Planned Later

- `src/runway/harness/app-registry.ts`
- `src/runway/scenarios/inventory.ts`

## Common Validations

`npm run harness:check` is scaffolded through `src/runway/cli.ts`; deeper harness implementation is planned later.

- `npm run typecheck`
- `npm run test`
- `npm run harness:check`
