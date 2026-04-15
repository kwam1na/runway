# Runway Testing

## Jump Links

- [Validation Ladder](#validation-ladder)
- [Harness Repair](#harness-repair)
- [Manual Extras](#manual-extras)

## Validation Ladder

This mirrors `npm run validate:pr`, which is present now as part of the scaffolded CLI surface.

1. `npm run typecheck`
2. `npm run test`
3. `npm run harness:check`
4. `npm run harness:audit`
5. `npm run harness:inferential-review`
6. `npm run harness:scorecard`

## Harness Repair

- If a changed file has no coverage, update the registry and regenerate docs.
- If a live file under an audited root has no coverage, fix the validation map generator input and rerun audit.
- If a deeper harness path is still missing, keep it in the planned-later sections until the source lands.

## Manual Extras

- `npm run harness:behavior` is an extra manual check, not part of `validate:pr`.
