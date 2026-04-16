import type {
  NormalizedDebtProfile,
  NormalizedFinancialProfile,
  PlannerImmediateAction,
  PlannerMonthlyPlanEntry,
  PlannerResult,
  PlannerRiskFlag,
} from "./contracts.js";

type DebtAllocation = {
  debt: NormalizedDebtProfile;
  amount: number;
  fullyPaid: boolean;
};

type PlannerState = {
  cash: number;
  monthlyBurn: number;
  allocations: DebtAllocation[];
  remainingDebts: NormalizedDebtProfile[];
};

function calculateWholeRunwayMonths(cash: number, monthlyBurn: number): number {
  if (monthlyBurn <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, Math.floor(cash / monthlyBurn));
}

function sortDebtsForInterestPriority(debts: readonly NormalizedDebtProfile[]): NormalizedDebtProfile[] {
  return [...debts].sort((left, right) => {
    if (left.apr !== right.apr) {
      return right.apr - left.apr;
    }

    if (left.minimum_payment !== right.minimum_payment) {
      return right.minimum_payment - left.minimum_payment;
    }

    if (left.balance !== right.balance) {
      return left.balance - right.balance;
    }

    return left.id.localeCompare(right.id);
  });
}

function selectSafeFullPayoff(
  debts: readonly NormalizedDebtProfile[],
  state: PlannerState,
  targetRunwayMonths: number,
): NormalizedDebtProfile | null {
  const eligible = debts
    .map((debt) => {
      if (debt.balance > state.cash) {
        return null;
      }

      const nextBurn = Math.max(0, state.monthlyBurn - debt.minimum_payment);
      const nextRunwayMonths = calculateWholeRunwayMonths(state.cash - debt.balance, nextBurn);
      if (nextRunwayMonths < targetRunwayMonths) {
        return null;
      }

      const projectedInterestCarry = debts
        .filter((candidate) => candidate.id !== debt.id)
        .reduce((sum, candidate) => sum + candidate.balance * candidate.apr, 0);

      return {
        debt,
        nextBurn,
        nextRunwayMonths,
        projectedInterestCarry,
      };
    })
    .filter((candidate): candidate is {
      debt: NormalizedDebtProfile;
      nextBurn: number;
      nextRunwayMonths: number;
      projectedInterestCarry: number;
    } => candidate !== null);

  if (eligible.length === 0) {
    return null;
  }

  return eligible.sort((left, right) => {
    if (left.nextRunwayMonths !== right.nextRunwayMonths) {
      return right.nextRunwayMonths - left.nextRunwayMonths;
    }

    if (left.nextBurn !== right.nextBurn) {
      return left.nextBurn - right.nextBurn;
    }

    if (left.projectedInterestCarry !== right.projectedInterestCarry) {
      return left.projectedInterestCarry - right.projectedInterestCarry;
    }

    return left.debt.id.localeCompare(right.debt.id);
  })[0]!.debt;
}

function allocateExtraDebtPaydown(profile: NormalizedFinancialProfile): PlannerState {
  const orderedDebts = sortDebtsForInterestPriority(profile.debts);
  const state: PlannerState = {
    cash: profile.cash_position.total_liquid_cash,
    monthlyBurn: Math.max(
      0,
      profile.monthly_obligations.total_monthly_burn - profile.income_assumptions.expected_monthly_income,
    ),
    allocations: [],
    remainingDebts: orderedDebts,
  };

  while (state.remainingDebts.length > 0) {
    const currentWholeRunwayMonths = calculateWholeRunwayMonths(state.cash, state.monthlyBurn);

    if (currentWholeRunwayMonths < profile.planning_preferences.runway_floor_months) {
      break;
    }

    const safeFullPayoff = selectSafeFullPayoff(
      state.remainingDebts,
      state,
      currentWholeRunwayMonths,
    );

    if (safeFullPayoff) {
      state.cash -= safeFullPayoff.balance;
      state.monthlyBurn = Math.max(0, state.monthlyBurn - safeFullPayoff.minimum_payment);
      state.allocations.push({
        debt: safeFullPayoff,
        amount: safeFullPayoff.balance,
        fullyPaid: true,
      });
      state.remainingDebts = state.remainingDebts.filter((debt) => debt.id !== safeFullPayoff.id);
      continue;
    }

    const partialBudget =
      currentWholeRunwayMonths === Number.POSITIVE_INFINITY
        ? state.cash
        : Math.max(0, state.cash - currentWholeRunwayMonths * state.monthlyBurn);

    if (partialBudget <= 0) {
      break;
    }

    const targetDebt = state.remainingDebts[0];
    if (!targetDebt) {
      break;
    }

    const payment = Math.min(partialBudget, targetDebt.balance);
    if (payment <= 0) {
      break;
    }

    state.cash -= payment;

    if (payment >= targetDebt.balance) {
      state.monthlyBurn = Math.max(0, state.monthlyBurn - targetDebt.minimum_payment);
      state.allocations.push({
        debt: targetDebt,
        amount: targetDebt.balance,
        fullyPaid: true,
      });
      state.remainingDebts = state.remainingDebts.slice(1);
      continue;
    }

    state.allocations.push({
      debt: targetDebt,
      amount: payment,
      fullyPaid: false,
    });
    state.remainingDebts = [
      {
        ...targetDebt,
        balance: targetDebt.balance - payment,
      },
      ...state.remainingDebts.slice(1),
    ];
    break;
  }

  return state;
}

function buildImmediateActions(
  profile: NormalizedFinancialProfile,
  state: PlannerState,
): PlannerImmediateAction[] {
  const actions: PlannerImmediateAction[] = [
    {
      type: "reserve-cash",
      summary: `Preserve at least ${profile.planning_preferences.runway_floor_months} whole months of runway before optional debt paydown.`,
      amount:
        profile.planning_preferences.runway_floor_months === Number.POSITIVE_INFINITY
          ? state.cash
          : profile.planning_preferences.runway_floor_months * state.monthlyBurn,
    },
  ];

  const minimumPaymentTotal = state.remainingDebts.reduce((sum, debt) => sum + debt.minimum_payment, 0);
  if (minimumPaymentTotal > 0) {
    actions.push({
      type: "pay-minimums",
      summary: "Cover all required debt minimums before considering optional extra payments.",
      amount: minimumPaymentTotal,
    });
  }

  for (const allocation of state.allocations) {
    actions.push({
      type: "pay-extra-debt",
      summary: allocation.fullyPaid
        ? `Fully pay ${allocation.debt.label} without reducing survivable whole-month runway.`
        : `Apply surplus cash to ${allocation.debt.label} without reducing survivable whole-month runway.`,
      amount: allocation.amount,
    });
  }

  return actions;
}

function buildMonthlyPlan(state: PlannerState): PlannerMonthlyPlanEntry[] {
  const wholeRunwayMonths = calculateWholeRunwayMonths(state.cash, state.monthlyBurn);
  const projectedMonths =
    wholeRunwayMonths === Number.POSITIVE_INFINITY ? 12 : Math.max(1, Math.min(12, wholeRunwayMonths + 1));
  const debtPayments = state.remainingDebts.map((debt) => ({
    debt_id: debt.id,
    amount: debt.minimum_payment,
  }));

  const plan: PlannerMonthlyPlanEntry[] = [];
  let currentCash = state.cash;

  for (let month = 1; month <= projectedMonths; month += 1) {
    const endingCash = Math.max(0, currentCash - state.monthlyBurn);
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
  runwayMonths: number,
): PlannerRiskFlag[] {
  if (runwayMonths >= profile.planning_preferences.runway_floor_months) {
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
  const state = allocateExtraDebtPaydown(profile);
  const runwayMonths = calculateWholeRunwayMonths(state.cash, state.monthlyBurn);
  const floorStatus = runwayMonths >= profile.planning_preferences.runway_floor_months ? "meets-floor" : "below-floor";

  return {
    snapshot: {
      liquid_cash: state.cash,
      monthly_burn: state.monthlyBurn,
      runway_months: runwayMonths,
    },
    recommended_immediate_actions: buildImmediateActions(profile, state),
    monthly_plan: buildMonthlyPlan(state),
    runway_estimate: {
      months: runwayMonths,
      floor_months: profile.planning_preferences.runway_floor_months,
      floor_status: floorStatus,
    },
    assumptions: [
      "No future income is assumed until it is confirmed.",
      "Extra debt paydown is only recommended when survivable whole-month runway does not drop.",
    ],
    risk_flags: buildRiskFlags(profile, runwayMonths),
  };
}
