# Runway Code Map

## Jump Links

- [Key Folders](#key-folders)
- [Planned Later](#planned-later)

## Key Folders

- Current source lives in `src/runway/index.ts`
- Current CLI surface lives in `src/runway/cli.ts`
- `src/runway/harness/`: registry-backed generation, check, review, and audit logic
- `src/runway/scenarios/`: executable runtime scenario inventory
- `docs/agent/`: local onboarding docs in this bootstrap checkout
- `docs/agent/analysis-workflow.md`: agent-agnostic intake, validation, and analysis guidance
- `src/runway/agents/`: implemented minimal agent loop for local profile progression and reruns
- `src/runway/finance/`: finance-domain logic
- `graphify-out/`: generated docs output
