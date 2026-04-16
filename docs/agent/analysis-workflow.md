# Runway Analysis Workflow

## Jump Links

- [Workflow](#workflow)
- [Shared Intake Contract](#shared-intake-contract)
- [Thin Wrapper Pattern](#thin-wrapper-pattern)
- [Boundaries](#boundaries)

## Workflow

Use the shared finance contract and runner for every agent integration so that intake, validation, analysis, and explanation stay consistent across wrappers.

1. Gather user inputs into a `LocalFinancialProfileInput` payload that preserves the shared field names.
2. Keep the confirmed profile in local-only storage such as a JSON file on disk.
3. Run validation through `normalizeFinancialProfile` or call `analyzeProfilePayload` directly.
4. If validation fails, surface each `ValidationIssue` back to the user with its `path`, `message`, and optional `question`.
5. Only rerun analysis after the user confirms the missing or corrected values.
6. Execute the local runner with `analyze <profile-path>` or `analyzeProfilePayload`.
7. Explain the result using the shared `report` and `result` output instead of restating calculation rules inside the wrapper.

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
  analyzeProfilePayload,
  type AnalysisOutcome,
  type LocalFinancialProfileInput,
} from "../finance/index.js";

export function runAgentAnalysis(payload: LocalFinancialProfileInput): AnalysisOutcome {
  return analyzeProfilePayload(payload);
}
```

Lower-level integration path when the wrapper needs separate validation and execution steps:

```ts
import {
  buildRunwayPlan,
  normalizeFinancialProfile,
  type LocalFinancialProfileInput,
} from "../finance/index.js";

export function runValidatedAgentAnalysis(payload: LocalFinancialProfileInput) {
  const normalized = normalizeFinancialProfile(payload);
  if (!normalized.ok) {
    return normalized;
  }

  return {
    ok: true,
    result: buildRunwayPlan(normalized.profile),
  };
}
```

Thin wrappers should collect inputs, persist local state, call the shared runner, and phrase the response. They should not duplicate payoff ranking, rewrite assumptions, rename schema keys, or override defaults owned by the shared contract.

## Boundaries

- Storage is local-only in v1. Do not assume shared cloud persistence or prompt-managed memory.
- The planner is runway-first. Wrappers must not swap in alternate optimization goals.
- No future income is assumed until it is confirmed.
- The output is a planning aid, not financial advice.
- Proprietary UI flows are out of scope for this contract.
- Core calculation and ranking logic stay in the shared engine, not in agent wrappers.
