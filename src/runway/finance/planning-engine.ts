import type {
  NormalizedDebtProfile,
  NormalizedFinancialProfile,
  PlannerImmediateAction,
  PlannerMonthlyPlanEntry,
  PlannerResult,
  PlannerRiskFlag,
} from "./contracts.js";

type CandidatePlan = {
  paidDebtIds: string[];
  remainingCash: number;
  monthlyBurn: number;
  runwayMonths: number;
  projectedInterestCarry: number;
  protectsFloor: boolean;
  unpaidDebts: NormalizedDebtProfile[];
};

function generateDebtSubsets(debts: readonly NormalizedDebtProfile[]): NormalizedDebtProfile[][] {
  const subsets: NormalizedDebtProfile[][] = [[]];

  for (const debt of debts) {
    const nextSubsets = subsets.map((subset) => [...subset, debt]);
    subsets.push(...nextSubsets);
  }

  return subsets;
}

function evaluateCandidatePlan(
  profile: NormalizedFinancialProfile,
  paidDebts: readonly NormalizedDebtProfile[],
): CandidatePlan | null {
  const upfrontDebtPayment = paidDebts.reduce((sum, debt) => sum + debt.balance, 0);
  const totalLiquidCash = profile.cash_position.total_liquid_cash;

  if (upfrontDebtPayment > totalLiquidCash) {
    return null;
  }

  const paidDebtIds = new Set(paidDebts.map((debt) => debt.id));
  const unpaidDebts = profile.debts.filter((debt) => !paidDebtIds.has(debt.id));
  const relievedMinimums = paidDebts.reduce((sum, debt) => sum + debt.minimum_payment, 0);
  const remainingCash = totalLiquidCash - upfrontDebtPayment;
  const monthlyBurn = Math.max(
    0,
    profile.monthly_obligations.total_monthly_burn -
      relievedMinimums -
      profile.income_assumptions.expected_monthly_income,
  );
  const runwayMonths = monthlyBurn === 0 ? Number.POSITIVE_INFINITY : remainingCash / monthlyBurn;
  const projectedInterestCarry = unpaidDebts.reduce((sum, debt) => sum + debt.balance * debt.apr, 0);

  return {
    paidDebtIds: [...paidDebtIds].sort(),
    remainingCash,
    monthlyBurn,
    runwayMonths,
    projectedInterestCarry,
    protectsFloor: runwayMonths >= profile.planning_preferences.runway_floor_months,
    unpaidDebts,
  };
}

function compareCandidates(left: CandidatePlan, right: CandidatePlan): number {
  if (left.protectsFloor !== right.protectsFloor) {
    return left.protectsFloor ? -1 : 1;
  }

  if (left.runwayMonths !== right.runwayMonths) {
    return right.runwayMonths - left.runwayMonths;
  }

  if (left.monthlyBurn !== right.monthlyBurn) {
    return left.monthlyBurn - right.monthlyBurn;
  }

  if (left.projectedInterestCarry !== right.projectedInterestCarry) {
    return left.projectedInterestCarry - right.projectedInterestCarry;
  }

  return left.paidDebtIds.join(",").localeCompare(right.paidDebtIds.join(","));
}

function buildImmediateActions(
  profile: NormalizedFinancialProfile,
  candidate: CandidatePlan,
): PlannerImmediateAction[] {
  const actions: PlannerImmediateAction[] = [
    {
      type: "reserve-cash",
      summary: `Preserve at least ${profile.planning_preferences.runway_floor_months} months of runway before any optional debt paydown.`,
      amount: profile.planning_preferences.runway_floor_months * candidate.monthlyBurn,
    },
  ];

  if (candidate.unpaidDebts.length > 0) {
    actions.push({
      type: "pay-minimums",
      summary: "Cover all required debt minimums before considering optional extra payments.",
      amount: candidate.unpaidDebts.reduce((sum, debt) => sum + debt.minimum_payment, 0),
    });
  }

  for (const debt of profile.debts.filter((entry) => candidate.paidDebtIds.includes(entry.id))) {
    actions.push({
      type: "pay-extra-debt",
      summary: `Fully pay ${debt.label} without breaching the configured runway floor.`,
      amount: debt.balance,
    });
  }

  return actions;
}

function buildMonthlyPlan(candidate: CandidatePlan): PlannerMonthlyPlanEntry[] {
  const projectedMonths = Number.isFinite(candidate.runwayMonths)
    ? Math.max(1, Math.min(12, Math.ceil(candidate.runwayMonths)))
    : 12;
  const debtPayments = candidate.unpaidDebts.map((debt) => ({
    debt_id: debt.id,
    amount: debt.minimum_payment,
  }));

  const plan: PlannerMonthlyPlanEntry[] = [];
  let currentCash = candidate.remainingCash;

  for (let month = 1; month <= projectedMonths; month += 1) {
    const endingCash = Math.max(0, currentCash - candidate.monthlyBurn);
    plan.push({
      month,
      starting_cash: currentCash,
      ending_cash: endingCash,
      debt_payments: debtPayments,
    });
    currentCash = endingCash;
  }

  return plan;
}

function buildRiskFlags(
  profile: NormalizedFinancialProfile,
  candidate: CandidatePlan,
): PlannerRiskFlag[] {
  if (candidate.protectsFloor) {
    return [];
  }

  return [
    {
      severity: "warning",
      summary: `Projected runway remains below the ${profile.planning_preferences.runway_floor_months}-month runway floor even after prioritizing cash preservation.`,
    },
  ];
}

export function buildRunwayPlan(profile: NormalizedFinancialProfile): PlannerResult {
  const candidates = generateDebtSubsets(profile.debts)
    .map((subset) => evaluateCandidatePlan(profile, subset))
    .filter((candidate): candidate is CandidatePlan => candidate !== null)
    .sort(compareCandidates);

  const bestCandidate = candidates[0] ?? evaluateCandidatePlan(profile, [])!;
  const floorStatus = bestCandidate.protectsFloor ? "meets-floor" : "below-floor";

  return {
    snapshot: {
      liquid_cash: bestCandidate.remainingCash,
      monthly_burn: bestCandidate.monthlyBurn,
      runway_months: bestCandidate.runwayMonths,
    },
    recommended_immediate_actions: buildImmediateActions(profile, bestCandidate),
    monthly_plan: buildMonthlyPlan(bestCandidate),
    runway_estimate: {
      months: bestCandidate.runwayMonths,
      floor_months: profile.planning_preferences.runway_floor_months,
      floor_status: floorStatus,
    },
    assumptions: [
      "No future income is assumed until it is confirmed.",
      "Extra debt paydown is only recommended when the runway floor remains protected.",
    ],
    risk_flags: buildRiskFlags(profile, bestCandidate),
  };
}
