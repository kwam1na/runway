# Runway Agent Index

## Jump Links

- [Scope](#scope)
- [Boundaries](#boundaries)
- [Planned Later](#planned-later)
- [Common Validations](#common-validations)

## Scope

`runway` is currently in a bootstrap state: it ships as a CLI-first TypeScript package shell with a registry-backed harness for generation, check, review, and audit flows.

## Boundaries

- Current source in this checkout lives in `src/runway/index.ts`
- Current CLI surface lives in `src/runway/cli.ts`
- Current manual onboarding docs live in `docs/agent/`
- Generated docs live in `graphify-out/`
- Registry data lives in `src/runway/harness/app-registry.ts`
- Scenario inventory lives in `src/runway/scenarios/inventory.ts`

## Common Validations

`npm run harness:generate`, `npm run harness:check`, `npm run harness:review`, and `npm run harness:audit` are routed through `src/runway/cli.ts` and evaluate the current registry plus generated outputs deterministically.

- `npm run typecheck`
- `npm run test`
- `npm run harness:generate`
- `npm run harness:check`
- `npm run harness:review`
