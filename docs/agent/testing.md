# Runway Testing

## Validation Ladder

This mirrors `npm run validate:pr`, which is planned and not runnable yet until `src/runway/cli.ts` exists.

1. `npm run typecheck`
2. `npm run test`
3. `npm run harness:check`
4. `npm run harness:audit`
5. `npm run harness:inferential-review`
6. `npm run harness:scorecard`

## Harness Repair

- If a changed file has no coverage, update the registry and regenerate docs.
- If a live file under an audited root has no coverage, fix the validation map generator input and rerun audit.

## Manual Extras

- `npm run harness:behavior` is an extra manual check, not part of `validate:pr`.
