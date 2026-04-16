# Runway Architecture

## Jump Links

- [Entrypoints](#entrypoints)
- [Edit Here, Not There](#edit-here-not-there)

## Entrypoints

- Package entrypoint: `src/runway/index.ts`
- CLI surface: `src/runway/cli.ts`
- Statement-intake helper path: `src/runway/statement-intake/`
- Registry source of truth: `src/runway/harness/app-registry.ts`
- Scenario inventory: `src/runway/scenarios/inventory.ts`

## Edit Here, Not There

- Edit the registry and scenario source files instead of hand-editing generated docs or validation JSON.
