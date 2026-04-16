import { readFile } from "node:fs/promises";
import type {
  LocalFinancialProfileInput,
  NormalizedFinancialProfile,
  PlannerResult,
  ValidationIssue,
} from "./contracts.js";
import { normalizeFinancialProfile } from "./contracts.js";
import { buildRunwayPlan } from "./planning-engine.js";

export type AnalysisSuccess = {
  ok: true;
  profile: NormalizedFinancialProfile;
  result: PlannerResult;
  report: string;
};

export type AnalysisFailure = {
  ok: false;
  errors: ValidationIssue[];
};

export type AnalysisOutcome = AnalysisSuccess | AnalysisFailure;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildMarkdownReport(result: PlannerResult): string {
  const monthlyPlanRows = result.monthly_plan
    .map((entry) => {
      const debtPayments =
        entry.debt_payments.length === 0
          ? "none"
          : entry.debt_payments
              .map((payment) => `${payment.debt_id}: ${formatCurrency(payment.amount)}`)
              .join(", ");
      return `- Month ${entry.month}: ${formatCurrency(entry.starting_cash)} -> ${formatCurrency(entry.ending_cash)} (${debtPayments})`;
    })
    .join("\n");

  const assumptions = [...result.assumptions, ...result.risk_flags.map((risk) => risk.summary)]
    .map((entry) => `- ${entry}`)
    .join("\n");

  return [
    "# Runway Analysis",
    "",
    "## Snapshot",
    `- Liquid cash: ${formatCurrency(result.snapshot.liquid_cash)}`,
    `- Monthly burn: ${formatCurrency(result.snapshot.monthly_burn)}`,
    `- Runway months: ${result.snapshot.runway_months}`,
    "",
    "## Recommended actions now",
    ...result.recommended_immediate_actions.map(
      (action) =>
        `- ${action.summary}${action.amount !== undefined ? ` (${formatCurrency(action.amount)})` : ""}`,
    ),
    "",
    "## Monthly plan",
    monthlyPlanRows || "- No monthly debt payments scheduled.",
    "",
    "## Risks and assumptions",
    assumptions || "- No additional risks or assumptions recorded.",
  ].join("\n");
}

export async function analyzeProfileFile(profilePath: string): Promise<AnalysisOutcome> {
  const raw = await readFile(profilePath, "utf8");
  const payload = JSON.parse(raw) as LocalFinancialProfileInput;
  return analyzeProfilePayload(payload);
}

export function analyzeProfilePayload(payload: LocalFinancialProfileInput): AnalysisOutcome {
  const normalized = normalizeFinancialProfile(payload);
  if (!normalized.ok) {
    return {
      ok: false,
      errors: normalized.errors,
    };
  }

  const result = buildRunwayPlan(normalized.profile);
  return {
    ok: true,
    profile: normalized.profile,
    result,
    report: buildMarkdownReport(result),
  };
}
