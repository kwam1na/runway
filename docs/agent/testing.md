# Runway Testing

## Jump Links

- [Validation Ladder](#validation-ladder)
- [Harness Repair](#harness-repair)
- [Manual Extras](#manual-extras)

## Validation Ladder

This starts with `npm run validate:pr` and adds the registry-refresh steps you should run when docs, generated outputs, or validation coverage change. The generate, check, review, and audit harness steps are deterministic registry-backed validations.

1. `npm run typecheck`
2. `npm run test`
3. `npm run harness:generate`
4. `npm run harness:check`
5. `npm run harness:review -- src/runway/cli.ts`
6. `npm run harness:audit`
7. `npm run harness:inferential-review`
8. `npm run harness:scorecard`

## Harness Repair

- If a changed file has no coverage, update the registry and regenerate docs.
- If a live file under an audited root has no coverage, fix the validation map generator input and rerun audit.

## Manual Extras

- `npm run harness:behavior` is an extra manual check, not part of `validate:pr`.
