export type ValidationIssue = {
  path: string;
  message: string;
  question?: string;
};

export type DebtProfileInput = {
  id?: string;
  label?: string;
  balance?: number;
  apr?: number;
  minimum_payment?: number;
};

export type LocalFinancialProfileInput = {
  cash_position?: {
    available_cash?: number;
    reserved_cash?: number;
    severance_total?: number;
  };
  monthly_obligations?: {
    essentials?: number;
    discretionary?: number;
  };
  debts?: DebtProfileInput[];
  income_assumptions?: {
    expected_monthly_income?: number;
    income_is_confirmed?: boolean;
    notes?: string[];
  };
  planning_preferences?: {
    strategy?: "runway-first";
    runway_floor_months?: number;
    prioritize_interest_savings?: boolean;
  };
};

export type NormalizedDebtProfile = {
  id: string;
  label: string;
  balance: number;
  apr: number;
  minimum_payment: number;
};

export type NormalizedFinancialProfile = {
  cash_position: {
    available_cash: number;
    reserved_cash: number;
    severance_total: number;
    total_liquid_cash: number;
  };
  monthly_obligations: {
    essentials: number;
    discretionary: number;
    debt_minimums: number;
    total_monthly_burn: number;
  };
  debts: NormalizedDebtProfile[];
  income_assumptions: {
    expected_monthly_income: number;
    income_is_confirmed: boolean;
    notes: string[];
  };
  planning_preferences: {
    strategy: "runway-first";
    runway_floor_months: number;
    prioritize_interest_savings: boolean;
  };
};

export type PlannerImmediateAction = {
  type: "reserve-cash" | "pay-minimums" | "pay-extra-debt" | "reduce-burn";
  summary: string;
  amount?: number;
};

export type PlannerMonthlyPlanEntry = {
  month: number;
  starting_cash: number;
  ending_cash: number;
  debt_payments: Array<{
    debt_id: string;
    amount: number;
  }>;
};

export type PlannerRiskFlag = {
  severity: "warning" | "critical";
  summary: string;
};

export type PlannerResult = {
  snapshot: {
    liquid_cash: number;
    monthly_burn: number;
    runway_months: number;
  };
  recommended_immediate_actions: PlannerImmediateAction[];
  monthly_plan: PlannerMonthlyPlanEntry[];
  runway_estimate: {
    months: number;
    floor_months: number;
    floor_status: "unknown" | "below-floor" | "meets-floor";
  };
  assumptions: string[];
  risk_flags: PlannerRiskFlag[];
};

export type FinancialProfileNormalizationResult =
  | {
      ok: true;
      profile: NormalizedFinancialProfile;
    }
  | {
      ok: false;
      errors: ValidationIssue[];
    };

const DEFAULT_RUNWAY_FLOOR_MONTHS = 6;

function isMissingNumber(value: number | undefined): value is undefined {
  return value === undefined || Number.isNaN(value);
}

function readNonNegativeNumber(
  value: number | undefined,
  path: string,
  missingMessage: string,
  negativeMessage: string,
  errors: ValidationIssue[],
): number | undefined {
  if (isMissingNumber(value)) {
    errors.push({ path, message: missingMessage });
    return undefined;
  }

  if (value < 0) {
    errors.push({ path, message: negativeMessage });
    return undefined;
  }

  return value;
}

function normalizeDebt(
  debt: DebtProfileInput,
  index: number,
  errors: ValidationIssue[],
): NormalizedDebtProfile | null {
  const label = debt.label?.trim() || `Debt ${index + 1}`;
  const id = debt.id?.trim() || `debt-${index + 1}`;
  const balance = readNonNegativeNumber(
    debt.balance,
    `debts[${index}].balance`,
    "Debt balance is required to measure remaining obligations.",
    "Debt balance cannot be negative.",
    errors,
  );

  if (isMissingNumber(debt.apr)) {
    errors.push({
      path: `debts[${index}].apr`,
      message: "Debt APR is required to compare payoff tradeoffs.",
      question: `What APR should runway use for debt "${label}"?`,
    });
  } else if (debt.apr < 0) {
    errors.push({
      path: `debts[${index}].apr`,
      message: "Debt APR cannot be negative.",
    });
  }

  if (isMissingNumber(debt.minimum_payment)) {
    errors.push({
      path: `debts[${index}].minimum_payment`,
      message: "Debt minimum payment is required to protect the monthly runway floor.",
      question: `What is the minimum monthly payment for debt "${label}"?`,
    });
  } else if (debt.minimum_payment < 0) {
    errors.push({
      path: `debts[${index}].minimum_payment`,
      message: "Debt minimum payment cannot be negative.",
    });
  }

  if (balance === undefined || isMissingNumber(debt.apr) || isMissingNumber(debt.minimum_payment)) {
    return null;
  }

  if (debt.apr < 0 || debt.minimum_payment < 0) {
    return null;
  }

  return {
    id,
    label,
    balance,
    apr: debt.apr,
    minimum_payment: debt.minimum_payment,
  };
}

export function normalizeFinancialProfile(
  input: LocalFinancialProfileInput,
): FinancialProfileNormalizationResult {
  const errors: ValidationIssue[] = [];
  const cashPosition = input.cash_position ?? {};
  const monthlyObligations = input.monthly_obligations ?? {};

  const availableCash = readNonNegativeNumber(
    cashPosition.available_cash,
    "cash_position.available_cash",
    "Available cash is required.",
    "Available cash cannot be negative.",
    errors,
  );
  const reservedCash = readNonNegativeNumber(
    cashPosition.reserved_cash,
    "cash_position.reserved_cash",
    "Reserved cash is required.",
    "Reserved cash cannot be negative.",
    errors,
  );
  const severanceTotal = readNonNegativeNumber(
    cashPosition.severance_total,
    "cash_position.severance_total",
    "Severance total is required.",
    "Severance total cannot be negative.",
    errors,
  );
  const essentials = readNonNegativeNumber(
    monthlyObligations.essentials,
    "monthly_obligations.essentials",
    "Essential monthly obligations are required.",
    "Essential monthly obligations cannot be negative.",
    errors,
  );

  const discretionaryValue = monthlyObligations.discretionary ?? 0;
  if (discretionaryValue < 0) {
    errors.push({
      path: "monthly_obligations.discretionary",
      message: "Discretionary monthly obligations cannot be negative.",
    });
  }

  const normalizedDebts = (input.debts ?? []).flatMap((debt, index) => {
    const normalized = normalizeDebt(debt, index, errors);
    return normalized ? [normalized] : [];
  });

  const expectedMonthlyIncomeInput = input.income_assumptions?.expected_monthly_income ?? 0;
  if (expectedMonthlyIncomeInput < 0) {
    errors.push({
      path: "income_assumptions.expected_monthly_income",
      message: "Expected monthly income cannot be negative.",
    });
  }

  const incomeIsConfirmed = input.income_assumptions?.income_is_confirmed ?? false;
  const normalizedIncome =
    incomeIsConfirmed && expectedMonthlyIncomeInput > 0 ? expectedMonthlyIncomeInput : 0;

  const runwayFloorMonths = input.planning_preferences?.runway_floor_months ?? DEFAULT_RUNWAY_FLOOR_MONTHS;
  if (runwayFloorMonths <= 0) {
    errors.push({
      path: "planning_preferences.runway_floor_months",
      message: "Runway floor months must be greater than zero.",
    });
  }

  if (
    errors.length > 0 ||
    availableCash === undefined ||
    reservedCash === undefined ||
    severanceTotal === undefined ||
    essentials === undefined ||
    discretionaryValue < 0 ||
    runwayFloorMonths <= 0
  ) {
    return {
      ok: false,
      errors,
    };
  }

  const debtMinimums = normalizedDebts.reduce((sum, debt) => sum + debt.minimum_payment, 0);

  return {
    ok: true,
    profile: {
      cash_position: {
        available_cash: availableCash,
        reserved_cash: reservedCash,
        severance_total: severanceTotal,
        total_liquid_cash: availableCash + reservedCash + severanceTotal,
      },
      monthly_obligations: {
        essentials,
        discretionary: discretionaryValue,
        debt_minimums: debtMinimums,
        total_monthly_burn: essentials + discretionaryValue + debtMinimums,
      },
      debts: normalizedDebts,
      income_assumptions: {
        expected_monthly_income: normalizedIncome,
        income_is_confirmed: incomeIsConfirmed,
        notes: [...(input.income_assumptions?.notes ?? [])],
      },
      planning_preferences: {
        strategy: "runway-first",
        runway_floor_months: runwayFloorMonths,
        prioritize_interest_savings: input.planning_preferences?.prioritize_interest_savings ?? false,
      },
    },
  };
}

export function createEmptyPlannerResult(): PlannerResult {
  return {
    snapshot: {
      liquid_cash: 0,
      monthly_burn: 0,
      runway_months: 0,
    },
    recommended_immediate_actions: [],
    monthly_plan: [],
    runway_estimate: {
      months: 0,
      floor_months: DEFAULT_RUNWAY_FLOOR_MONTHS,
      floor_status: "unknown",
    },
    assumptions: [],
    risk_flags: [],
  };
}
