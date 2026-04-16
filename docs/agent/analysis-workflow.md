# Runway Analysis Workflow

## Jump Links

- [Workflow](#workflow)
- [Shared Intake Contract](#shared-intake-contract)
- [Thin Wrapper Pattern](#thin-wrapper-pattern)
- [Boundaries](#boundaries)

## Workflow

Use the shared finance contract and runner for every agent integration so that intake, validation, analysis, and explanation stay consistent across wrappers.

1. Gather user inputs into a `LocalFinancialProfileInput` payload that preserves the shared field names.
2. Keep the working profile in local-only storage such as a JSON file on disk.
3. Run the minimal agent loop through `runAgentWorkflow` or `assist [profile-path] [answer-patch-path] [--statements <file> ...]`.
4. If validation fails, surface each `ValidationIssue` back to the user with its `path`, `message`, and optional `question`.
5. In non-interactive contexts, save only the user-confirmed corrections into a local answer patch and rerun the same workflow.
6. In a real TTY without an answer patch, let `assist` ask the next validator-driven question, write the accepted answer directly back into the profile file, and rerun until the workflow reaches `ready`.
7. When the workflow reaches `ready`, present the shared `report` and `result` output instead of restating calculation rules inside the wrapper.
8. Keep any extra agent-specific phrasing outside the planning logic.

Happy path:

```json
{
  "cash_position": {
    "available_cash": 18000,
    "reserved_cash": 2500,
    "severance_total": 12000
  },
  "monthly_obligations": {
    "essentials": 3200,
    "discretionary": 450
  },
  "debts": [
    {
      "id": "card-a",
      "label": "Card A",
      "balance": 6400,
      "apr": 0.2399,
      "minimum_payment": 220
    }
  ],
  "income_assumptions": {
    "expected_monthly_income": 0,
    "income_is_confirmed": false,
    "notes": []
  },
  "planning_preferences": {
    "strategy": "runway-first",
    "runway_floor_months": 6,
    "prioritize_interest_savings": false
  }
}
```

With a complete profile saved locally, run the CLI entrypoint:

```bash
tsx src/runway/cli.ts analyze <profile-path>
```

The runner returns structured JSON with a `result` payload plus a Markdown `report`. The wrapper should present those outputs, summarize the most important next steps, and keep any extra agent-specific language outside the planning logic.

Minimal local agent loop:

```bash
tsx src/runway/cli.ts assist [profile-path] [answer-patch-path] [--statements <file> ...]
```

The `assist` command supports two wrapper modes that share the same validation and planning engine:

- Non-interactive mode: loads the current local profile, optionally merges a local answer patch, and returns one of two deterministic JSON states.
- Interactive TTY mode: if no patch file is provided and both stdin and stdout are TTYs, asks the next validator-driven question, writes the accepted answer directly back into the profile file, and reruns until the profile is complete.
- Pathless interactive mode: if `assist` is run in a real TTY with no profile path, the CLI creates a new local profile at `./runway-profile.json` or the next available `./runway-profile-<n>.json`, collects the initial intake interactively, and then continues through the same validator-driven loop.

When `--statements <file> ...` is supplied in the interactive flow, `assist` first runs local-only statement extraction before the normal validator loop:

- Supported files currently include local credit card statement PDFs plus `PNG`, `JPG`, and `JPEG` images.
- Digital PDFs prefer embedded text extraction.
- Image statements use local OCR directly.
- PDFs without an embedded text layer fall back to local OCR after local PDF rasterization.
- Extracted balances, minimum payments, labels, and APR candidates are shown back to the user for confirm, edit, or skip review before any debt values are written into the profile.
- Multiple APR candidates require an explicit user choice before the planning `apr` field is set.

The non-interactive mode returns one of two deterministic states:

- `needs-input`: includes `validationIssues` plus `followUpQuestions` for the exact missing answers to ask next.
- `ready`: includes the merged profile, shared `result`, and shared Markdown `report`.

The interactive mode keeps the profile JSON file as the live session state:

- When statement files are provided, reviewed debt values are merged into `debts[]` before validator-driven follow-up questions continue.
- Accepted numeric answers currently cover debt APR and debt minimum-payment follow-ups.
- Accepted boolean answers currently cover `income_assumptions.income_is_confirmed`.
- Invalid numeric or boolean answers reprompt without mutating the file.
- Before the first accepted interactive write, the CLI creates a one-time `<profile-path>.bak` snapshot and leaves any existing backup untouched.

If a wrapper needs to bypass the higher-level loop, the lower-level shared finance entry points `analyzeProfilePayload` and `buildRunwayPlan` remain available behind the agent workflow layer.

Incomplete intake path:

```text
income_assumptions.income_is_confirmed:
Expected monthly income must be confirmed before runway can count it.:
Is the expected monthly income confirmed enough to include in runway planning?
```

When the profile is incomplete, ask only for the missing values identified by the shared validator. Do not infer missing APRs, minimum payments, or income confirmation flags inside the wrapper.

## Shared Intake Contract

The shared schema lives in `src/runway/finance/contracts.ts`.

- Use `LocalFinancialProfileInput` for raw local intake.
- Use `normalizeFinancialProfile` to turn raw inputs into the canonical normalized profile.
- Use `ValidationIssue` to send targeted follow-up questions back to the user.
- Preserve the contract field names exactly, including `available_cash`, `reserved_cash`, `severance_total`, `expected_monthly_income`, and `income_is_confirmed`.
- Preserve the v1 planning preference contract: `strategy` must stay `runway-first`.

## Thin Wrapper Pattern

Preferred wrapper path:

```ts
import {
  runAgentWorkflow,
  type AgentWorkflowOutcome,
  type LocalFinancialProfileInput,
} from "../agents/index.js";

export function runAgentAnalysis(payload: LocalFinancialProfileInput): AgentWorkflowOutcome {
  return runAgentWorkflow(payload);
}
```

Lower-level integration path when the wrapper needs separate validation and execution steps:

```ts
import {
  mergeFinancialProfilePatch,
  runAgentWorkflow,
  type LocalFinancialProfileInput,
} from "../agents/index.js";

export function runValidatedAgentAnalysis(
  payload: LocalFinancialProfileInput,
  answerPatch?: LocalFinancialProfileInput,
) {
  const mergedPayload = mergeFinancialProfilePatch(payload, answerPatch);
  return runAgentWorkflow(mergedPayload);
}
```

Thin wrappers should collect inputs, persist local state, call the shared runner, and phrase the response. They should not duplicate payoff ranking, rewrite assumptions, rename schema keys, or override defaults owned by the shared contract.

Statement ingestion remains an intake helper around the shared workflow rather than a second planning path:

- file parsing and OCR live under `src/runway/statement-intake/`
- extracted fields must be reviewed before profile mutation
- the shared finance contract still validates and normalizes all debt values before planning

## Boundaries

- Storage is local-only in v1. Do not assume shared cloud persistence or prompt-managed memory.
- Statement extraction and OCR are local-only. Do not send statement contents to cloud parsers or hosted OCR services from wrappers.
- The planner is runway-first. Wrappers must not swap in alternate optimization goals.
- No future income is assumed until it is confirmed.
- The output is a planning aid, not financial advice.
- Proprietary UI flows are out of scope for this contract.
- Core calculation and ranking logic stay in the shared engine, not in agent wrappers.
