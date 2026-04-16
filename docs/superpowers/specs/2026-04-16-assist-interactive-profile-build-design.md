# Assist Interactive Profile Build Design

**Date:** 2026-04-16

## Goal

Extend the existing `runway assist <profile-path> [answer-patch-path]` agent workflow so the CLI can build a profile interactively in the terminal. When a profile is incomplete and the command is running in a TTY, the CLI should ask the next validator-driven follow-up question, write the accepted answer directly back into the profile file, rerun the shared workflow, and continue until the profile is ready for analysis.

## Why

The current implementation proves the minimal agent loop, but it still expects the user to prepare or patch JSON files manually. That keeps the workflow technically agentic, but it is awkward for actual CLI use. The next step is to let the CLI act as the terminal-facing agent while keeping validation and planning logic in the shared engine.

## Recommended Approach

Keep `assist` as the single agent entrypoint and add an interactive TTY mode on top of the existing file-based workflow.

This is preferred over adding a second command because:

- it preserves one obvious way to run the agent workflow
- it keeps existing scripted and fixture-based `assist` usage intact
- it adds interactivity without splitting the product surface into separate "machine" and "human" commands

## User Experience

### Non-interactive mode

If `assist` is run without a TTY or with an explicit answer-patch file, it should keep the current deterministic behavior:

1. Load the profile file.
2. Optionally load the answer-patch file.
3. Run the agent workflow.
4. Return JSON with either:
   - `status: "needs-input"` and follow-up questions, or
   - `status: "ready"` and the shared result/report.

### Interactive mode

If `assist` is run in a TTY without an answer-patch file and the profile is incomplete:

1. Load the profile file.
2. Run the shared agent workflow.
3. If the workflow returns `needs-input`, take the first actionable follow-up question.
4. Prompt the user in the terminal.
5. Parse the answer into the expected type.
6. Write the accepted answer directly back into the profile JSON.
7. Rerun the workflow.
8. Repeat until the workflow returns `ready`.
9. Print the final structured result and report.

The wizard is intentionally narrow: it should only ask for fields the validator explicitly reports as missing or ambiguous.

## Architecture

### Shared workflow ownership

The shared finance and agent layers remain the source of truth for what is missing and when the profile is complete.

- `src/runway/agents/` continues to decide whether the profile is in `needs-input` or `ready` state.
- `src/runway/finance/` continues to own validation, field semantics, and planning logic.
- `src/runway/cli.ts` owns terminal prompting, parsing, and file persistence.

This keeps the CLI from inventing its own questionnaire rules or duplicating planner behavior.

### Session state

The profile JSON file itself is the live session state.

- There is no separate session object or memory layer in the first version.
- There is no journaled patch chain.
- Each accepted answer is persisted immediately to disk.

This keeps the implementation small and makes the current profile state inspectable outside the CLI at any moment.

## Input Rules

The first version should support the answer types already implied by the current validator questions.

### Numbers

Used for values such as:

- `debts[0].apr`
- `debts[0].minimum_payment`

Rules:

- Accept plain numeric input such as `220` or `0.2399`.
- Reject non-finite or malformed numeric strings.
- On parse failure, reprompt and do not mutate the file.

### Booleans

Used for fields such as:

- `income_assumptions.income_is_confirmed`

Rules:

- Accept `y`, `yes`, `true` as `true`.
- Accept `n`, `no`, `false` as `false`.
- Ignore case and surrounding whitespace.
- On parse failure, reprompt and do not mutate the file.

### Short text

No current follow-up question requires this, but the prompting layer may support trimmed string answers if future validator questions need them.

## File Mutation Rules

### Backup

Before the first interactive mutation, create a one-time backup at:

`<profile-path>.bak`

Rules:

- Only create it once per command run.
- Do not overwrite an existing backup in the first version; if it already exists, leave it untouched.

### Persistence

After each accepted answer:

- update the nested field in memory
- rewrite the full JSON file with stable pretty printing
- rerun the workflow from the updated file state

The write path should fail loudly if the file cannot be written.

## Prompt Selection

The first version should ask one question at a time in validator order.

Selection rules:

1. Read `followUpQuestions` from the workflow result.
2. Take the first entry with a usable `question`.
3. Infer parsing behavior from the field path and known contract shape.
4. Prompt once.
5. Repeat until the answer is valid.

If validation fails but there are no `followUpQuestions`, the CLI should stop and fall back to the existing non-interactive error output. That protects against hiding unexpected contract failures behind an incomplete wizard.

## Scope Limits

The first version should not include:

- editing already-populated values
- back/undo navigation
- multi-profile session management
- autosave journals beyond the profile file itself
- freeform conversational handling
- prompts for fields that the validator did not request

These can be added later if the terminal workflow proves valuable.

## Testing Strategy

### CLI interaction tests

Add focused tests that verify:

- interactive prompting fills a missing numeric field and writes it back to the profile
- interactive prompting fills a missing boolean field and writes it back to the profile
- invalid input reprompts without mutating the file
- the command reaches `ready` and emits the shared result/report after the last required answer

### Non-interactive regression tests

Preserve existing tests for:

- file-based `assist` follow-up output
- answer-patch rerun behavior
- malformed patch-file errors

### Harness and docs coverage

Update docs and harness expectations so the repo explicitly describes the interactive CLI profile-building behavior.

## Risks and Tradeoffs

### Strengths

- minimal surface-area increase
- preserves existing scripted behavior
- keeps logic ownership in the shared validator/planner
- direct file writes make progress durable immediately

### Costs

- direct mutation is less reversible than a patch-only workflow
- path-to-type inference in the CLI adds some coupling to the contract shape
- interactive terminal testing is more complex than plain function tests

## Success Criteria

The feature is successful when:

- a user can start with an incomplete profile JSON
- run `assist <profile-path>` in a terminal
- answer validator-driven questions one at a time
- see those answers written directly into the profile file
- reach a final `ready` analysis result without manually editing JSON
