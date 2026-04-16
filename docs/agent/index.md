# Runway Agent Index

## Jump Links

- [Scope](#scope)
- [Boundaries](#boundaries)
- [Finance Workflow](#finance-workflow)
- [Planned Later](#planned-later)
- [Common Validations](#common-validations)

## Scope

`runway` is a CLI-first TypeScript package with shared finance contracts, a minimal local agent loop, an interactive TTY-assisted profile builder, a local analysis runner, and a registry-backed harness for generation, check, review, and audit flows.

## Boundaries

- Current source in this checkout lives in `src/runway/index.ts`
- Current CLI surface lives in `src/runway/cli.ts`
- Current manual onboarding docs live in `docs/agent/`
- The finance intake and recommendation workflow is documented in `docs/agent/analysis-workflow.md`
- Generated docs live in `graphify-out/`
- Registry data lives in `src/runway/harness/app-registry.ts`
- Scenario inventory lives in `src/runway/scenarios/inventory.ts`

## Finance Workflow

Use `src/runway/cli.ts assist <profile-path> [answer-patch-path]` for the agent-style loop, or `src/runway/cli.ts analyze <profile-path>` when you already have a complete local profile. In a real TTY without a patch file, `assist` now asks validator-driven follow-up questions, writes accepted answers directly back into the profile file, and preserves a one-time `<profile-path>.bak` backup before the first interactive mutation. The agent workflow implementation lives in `src/runway/agents/`, while `src/runway/finance/` remains the source of truth for validation and planning logic. `docs/agent/analysis-workflow.md` is the source of truth for wrapper expectations, local-only storage, and the runway-first boundaries.

## Common Validations

`npm run harness:generate`, `npm run harness:check`, `npm run harness:review`, and `npm run harness:audit` are routed through `src/runway/cli.ts` and evaluate the current registry plus generated outputs deterministically. The `analyze` command uses the shared local finance contract and planner runner rather than wrapper-owned business rules.

- `npm run typecheck`
- `npm run test`
- `npm run harness:generate`
- `npm run harness:check`
- `npm run harness:review`
