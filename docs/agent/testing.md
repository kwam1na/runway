# Runway Testing

## Validation Ladder

1. `npm run typecheck`
2. `npm run test`
3. `npm run harness:check`
4. `npm run harness:audit`
5. `npm run harness:behavior`

## Harness Repair

- If a changed file has no coverage, update the registry and regenerate docs.
- If a live file under an audited root has no coverage, fix the validation map generator input and rerun audit.
