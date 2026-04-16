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

export type PlannerImmediateActionInput = {
  type?: PlannerImmediateAction["type"];
  summary?: string;
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

export type PlannerMonthlyPlanEntryInput = {
  month?: number;
  starting_cash?: number;
  ending_cash?: number;
  debt_payments?: Array<{
    debt_id?: string;
    amount?: number;
  }>;
};

export type PlannerRiskFlag = {
  severity: "warning" | "critical";
  summary: string;
};

export type PlannerRiskFlagInput = {
  severity?: PlannerRiskFlag["severity"];
  summary?: string;
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

export type PlannerResultInput = {
  snapshot?: {
    liquid_cash?: number;
    monthly_burn?: number;
    runway_months?: number;
  };
  recommended_immediate_actions?: PlannerImmediateActionInput[];
  monthly_plan?: PlannerMonthlyPlanEntryInput[];
  runway_estimate?: {
    months?: number;
    floor_months?: number;
    floor_status?: PlannerResult["runway_estimate"]["floor_status"];
  };
  assumptions?: string[];
  risk_flags?: PlannerRiskFlagInput[];
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

export type PlannerResultNormalizationResult =
  | {
      ok: true;
      result: PlannerResult;
    }
  | {
      ok: false;
      errors: ValidationIssue[];
    };

const DEFAULT_RUNWAY_FLOOR_MONTHS = 6;
const plannerActionTypes = new Set<PlannerImmediateAction["type"]>([
  "reserve-cash",
  "pay-minimums",
  "pay-extra-debt",
  "reduce-burn",
]);
const plannerRiskSeverities = new Set<PlannerRiskFlag["severity"]>(["warning", "critical"]);
const runwayFloorStatuses = new Set<PlannerResult["runway_estimate"]["floor_status"]>([
  "unknown",
  "below-floor",
  "meets-floor",
]);

function isMissingNumber(value: number | undefined): value is undefined {
  return value === undefined || Number.isNaN(value);
}

function isFiniteNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonNegativeNumber(
  value: number | undefined,
  path: string,
  missingMessage: string,
  negativeMessage: string,
  nonFiniteMessage: string,
  errors: ValidationIssue[],
): number | undefined {
  if (isMissingNumber(value)) {
    errors.push({ path, message: missingMessage });
    return undefined;
  }

  if (!isFiniteNumber(value)) {
    errors.push({ path, message: nonFiniteMessage });
    return undefined;
  }

  if (value < 0) {
    errors.push({ path, message: negativeMessage });
    return undefined;
  }

  return value;
}

function readPositiveNumber(
  value: number | undefined,
  path: string,
  missingMessage: string,
  nonPositiveMessage: string,
  nonFiniteMessage: string,
  errors: ValidationIssue[],
): number | undefined {
  const parsed = readNonNegativeNumber(
    value,
    path,
    missingMessage,
    nonPositiveMessage,
    nonFiniteMessage,
    errors,
  );

  if (parsed === undefined) {
    return undefined;
  }

  if (parsed <= 0) {
    errors.push({ path, message: nonPositiveMessage });
    return undefined;
  }

  return parsed;
}

function readRequiredText(
  value: string | undefined,
  path: string,
  message: string,
  errors: ValidationIssue[],
): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    errors.push({ path, message });
    return undefined;
  }

  return trimmed;
}

function readArray<T>(
  value: T[] | undefined,
  path: string,
  message: string,
  errors: ValidationIssue[],
): T[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push({ path, message });
    return [];
  }

  return value;
}

function readOptionalBoolean(
  value: boolean | undefined,
  path: string,
  message: string,
  errors: ValidationIssue[],
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    errors.push({ path, message });
    return undefined;
  }

  return value;
}

function normalizeStringArray(
  value: string[] | undefined,
  path: string,
  arrayMessage: string,
  itemMessage: string,
  errors: ValidationIssue[],
): string[] {
  return readArray(value, path, arrayMessage, errors).flatMap((item, index) => {
    if (typeof item !== "string") {
      errors.push({
        path: `${path}[${index}]`,
        message: itemMessage,
      });
      return [];
    }

    const normalized = readRequiredText(item, `${path}[${index}]`, itemMessage, errors);
    return normalized ? [normalized] : [];
  });
}

function normalizeDebt(
  debt: DebtProfileInput,
  index: number,
  errors: ValidationIssue[],
): NormalizedDebtProfile | null {
  if (typeof debt !== "object" || debt === null || Array.isArray(debt)) {
    errors.push({
      path: `debts[${index}]`,
      message: "Each debt must be provided as an object.",
    });
    return null;
  }

  const label = debt.label?.trim() || `Debt ${index + 1}`;
  const id = debt.id?.trim() || `debt-${index + 1}`;
  const balance = readNonNegativeNumber(
    debt.balance,
    `debts[${index}].balance`,
    "Debt balance is required to measure remaining obligations.",
    "Debt balance cannot be negative.",
    "Debt balance must be a finite number.",
    errors,
  );

  if (isMissingNumber(debt.apr)) {
    errors.push({
      path: `debts[${index}].apr`,
      message: "Debt APR is required to compare payoff tradeoffs.",
      question: `What APR should runway use for debt "${label}"?`,
    });
  } else if (!isFiniteNumber(debt.apr)) {
    errors.push({
      path: `debts[${index}].apr`,
      message: "Debt APR must be a finite number.",
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
  } else if (!isFiniteNumber(debt.minimum_payment)) {
    errors.push({
      path: `debts[${index}].minimum_payment`,
      message: "Debt minimum payment must be a finite number.",
    });
  } else if (debt.minimum_payment < 0) {
    errors.push({
      path: `debts[${index}].minimum_payment`,
      message: "Debt minimum payment cannot be negative.",
    });
  }

  if (
    balance === undefined ||
    isMissingNumber(debt.apr) ||
    isMissingNumber(debt.minimum_payment) ||
    !isFiniteNumber(debt.apr) ||
    !isFiniteNumber(debt.minimum_payment)
  ) {
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
  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: [
        {
          path: "$",
          message: "Financial profile payload must be an object.",
        },
      ],
    };
  }

  const errors: ValidationIssue[] = [];
  const cashPosition = input.cash_position ?? {};
  const monthlyObligations = input.monthly_obligations ?? {};
  const debts = readArray(input.debts, "debts", "Debts must be provided as an array.", errors);
  const normalizedNotes = normalizeStringArray(
    input.income_assumptions?.notes,
    "income_assumptions.notes",
    "Income assumption notes must be provided as an array of strings.",
    "Income assumption notes must be non-empty strings.",
    errors,
  );
  const incomeIsConfirmed =
    readOptionalBoolean(
      input.income_assumptions?.income_is_confirmed,
      "income_assumptions.income_is_confirmed",
      "Income confirmation must be a boolean.",
      errors,
    ) ?? false;
  const prioritizeInterestSavings =
    readOptionalBoolean(
      input.planning_preferences?.prioritize_interest_savings,
      "planning_preferences.prioritize_interest_savings",
      "Interest-savings preference must be a boolean.",
      errors,
    ) ?? false;

  if (
    input.planning_preferences?.strategy !== undefined &&
    input.planning_preferences.strategy !== "runway-first"
  ) {
    errors.push({
      path: "planning_preferences.strategy",
      message: "Planning strategy must be runway-first in v1.",
    });
  }

  const availableCash = readNonNegativeNumber(
    cashPosition.available_cash,
    "cash_position.available_cash",
    "Available cash is required.",
    "Available cash cannot be negative.",
    "Available cash must be a finite number.",
    errors,
  );
  const reservedCash = readNonNegativeNumber(
    cashPosition.reserved_cash,
    "cash_position.reserved_cash",
    "Reserved cash is required.",
    "Reserved cash cannot be negative.",
    "Reserved cash must be a finite number.",
    errors,
  );
  const severanceTotal = readNonNegativeNumber(
    cashPosition.severance_total,
    "cash_position.severance_total",
    "Severance total is required.",
    "Severance total cannot be negative.",
    "Severance total must be a finite number.",
    errors,
  );
  const essentials = readNonNegativeNumber(
    monthlyObligations.essentials,
    "monthly_obligations.essentials",
    "Essential monthly obligations are required.",
    "Essential monthly obligations cannot be negative.",
    "Essential monthly obligations must be a finite number.",
    errors,
  );

  const discretionaryValue = monthlyObligations.discretionary ?? 0;
  if (!Number.isFinite(discretionaryValue)) {
    errors.push({
      path: "monthly_obligations.discretionary",
      message: "Discretionary monthly obligations must be a finite number.",
    });
  } else if (discretionaryValue < 0) {
    errors.push({
      path: "monthly_obligations.discretionary",
      message: "Discretionary monthly obligations cannot be negative.",
    });
  }

  const normalizedDebtEntries = debts.map((debt, index) => ({
    index,
    normalized: normalizeDebt(debt, index, errors),
  }));
  const normalizedDebts = normalizedDebtEntries.flatMap((entry) =>
    entry.normalized ? [entry.normalized] : [],
  );
  const seenDebtIds = new Set<string>();
  for (const entry of normalizedDebtEntries) {
    if (!entry.normalized) {
      continue;
    }

    if (seenDebtIds.has(entry.normalized.id)) {
      errors.push({
        path: `debts[${entry.index}].id`,
        message: "Debt identifiers must be unique across the profile.",
      });
      continue;
    }

    seenDebtIds.add(entry.normalized.id);
  }

  const expectedMonthlyIncomeInput = input.income_assumptions?.expected_monthly_income ?? 0;
  if (!Number.isFinite(expectedMonthlyIncomeInput)) {
    errors.push({
      path: "income_assumptions.expected_monthly_income",
      message: "Expected monthly income must be a finite number.",
    });
  } else if (expectedMonthlyIncomeInput < 0) {
    errors.push({
      path: "income_assumptions.expected_monthly_income",
      message: "Expected monthly income cannot be negative.",
    });
  }

  const normalizedIncome =
    incomeIsConfirmed && expectedMonthlyIncomeInput > 0 ? expectedMonthlyIncomeInput : 0;

  const runwayFloorMonths =
    input.planning_preferences?.runway_floor_months ?? DEFAULT_RUNWAY_FLOOR_MONTHS;
  const normalizedRunwayFloorMonths = readPositiveNumber(
    runwayFloorMonths,
    "planning_preferences.runway_floor_months",
    "Runway floor months are required.",
    "Runway floor months must be greater than zero.",
    "Runway floor months must be a finite number.",
    errors,
  );

  if (
    errors.length > 0 ||
    availableCash === undefined ||
    reservedCash === undefined ||
    severanceTotal === undefined ||
    essentials === undefined ||
    !Number.isFinite(discretionaryValue) ||
    discretionaryValue < 0 ||
    normalizedRunwayFloorMonths === undefined
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
        notes: normalizedNotes,
      },
      planning_preferences: {
        strategy: "runway-first",
        runway_floor_months: normalizedRunwayFloorMonths,
        prioritize_interest_savings: prioritizeInterestSavings,
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

export function normalizePlannerResult(
  input: PlannerResultInput,
): PlannerResultNormalizationResult {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: [
        {
          path: "$",
          message: "Planner result payload must be an object.",
        },
      ],
    };
  }

  const errors: ValidationIssue[] = [];
  const snapshot = input.snapshot ?? {};
  const runwayEstimate = input.runway_estimate ?? {};
  const recommendedImmediateActionInputs = readArray(
    input.recommended_immediate_actions,
    "recommended_immediate_actions",
    "Recommended actions must be provided as an array.",
    errors,
  );
  const monthlyPlanInputs = readArray(
    input.monthly_plan,
    "monthly_plan",
    "Monthly plan entries must be provided as an array.",
    errors,
  );
  const assumptionsInput = normalizeStringArray(
    input.assumptions,
    "assumptions",
    "Assumptions must be provided as an array of strings.",
    "Assumptions must be non-empty strings.",
    errors,
  );
  const riskFlagInputs = readArray(
    input.risk_flags,
    "risk_flags",
    "Risk flags must be provided as an array.",
    errors,
  );

  const liquidCash = readNonNegativeNumber(
    snapshot.liquid_cash,
    "snapshot.liquid_cash",
    "Snapshot liquid cash is required.",
    "Snapshot liquid cash cannot be negative.",
    "Snapshot liquid cash must be a finite number.",
    errors,
  );
  const monthlyBurn = readNonNegativeNumber(
    snapshot.monthly_burn,
    "snapshot.monthly_burn",
    "Snapshot monthly burn is required.",
    "Snapshot monthly burn cannot be negative.",
    "Snapshot monthly burn must be a finite number.",
    errors,
  );
  const runwayMonths = readNonNegativeNumber(
    snapshot.runway_months,
    "snapshot.runway_months",
    "Snapshot runway months is required.",
    "Snapshot runway months cannot be negative.",
    "Snapshot runway months must be a finite number.",
    errors,
  );
  const estimatedMonths = readNonNegativeNumber(
    runwayEstimate.months,
    "runway_estimate.months",
    "Runway estimate months is required.",
    "Runway estimate months cannot be negative.",
    "Runway estimate months must be a finite number.",
    errors,
  );
  const floorMonths = readPositiveNumber(
    runwayEstimate.floor_months ?? DEFAULT_RUNWAY_FLOOR_MONTHS,
    "runway_estimate.floor_months",
    "Runway floor months is required.",
    "Runway floor months must be greater than zero.",
    "Runway floor months must be a finite number.",
    errors,
  );

  const floorStatus = runwayEstimate.floor_status ?? "unknown";
  if (!runwayFloorStatuses.has(floorStatus)) {
    errors.push({
      path: "runway_estimate.floor_status",
      message: "Runway floor status must be unknown, below-floor, or meets-floor.",
    });
  }

  const recommendedImmediateActions = recommendedImmediateActionInputs.flatMap(
    (action, index) => {
      if (typeof action !== "object" || action === null || Array.isArray(action)) {
        errors.push({
          path: `recommended_immediate_actions[${index}]`,
          message: "Recommended actions must be objects.",
        });
        return [];
      }

      const summary = readRequiredText(
        action.summary,
        `recommended_immediate_actions[${index}].summary`,
        "Planner actions must include a short summary.",
        errors,
      );

      if (!action.type || !plannerActionTypes.has(action.type)) {
        errors.push({
          path: `recommended_immediate_actions[${index}].type`,
          message: "Planner actions must use a supported action type.",
        });
      }

      let amount = action.amount;
      if (amount !== undefined) {
        amount = readNonNegativeNumber(
          amount,
          `recommended_immediate_actions[${index}].amount`,
          "Planner action amounts are required when provided.",
          "Planner action amounts cannot be negative.",
          "Planner action amounts must be a finite number.",
          errors,
        );
      }

      if (!summary || !action.type || !plannerActionTypes.has(action.type)) {
        return [];
      }

      const normalizedAction: PlannerImmediateAction = {
        type: action.type,
        summary,
      };

      if (amount !== undefined) {
        normalizedAction.amount = amount;
      }

      return [normalizedAction];
    },
  );

  const monthlyPlan = monthlyPlanInputs.flatMap((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push({
        path: `monthly_plan[${index}]`,
        message: "Monthly plan entries must be objects.",
      });
      return [];
    }

    const month = readPositiveNumber(
      entry.month,
      `monthly_plan[${index}].month`,
      "Monthly plan entries must include a month number.",
      "Monthly plan months must be greater than zero.",
      "Monthly plan months must be a finite number.",
      errors,
    );
    const startingCash = readNonNegativeNumber(
      entry.starting_cash,
      `monthly_plan[${index}].starting_cash`,
      "Monthly plan entries must include starting cash.",
      "Monthly plan starting cash cannot be negative.",
      "Monthly plan starting cash must be a finite number.",
      errors,
    );
    const endingCash = readNonNegativeNumber(
      entry.ending_cash,
      `monthly_plan[${index}].ending_cash`,
      "Monthly plan entries must include ending cash.",
      "Monthly plan ending cash cannot be negative.",
      "Monthly plan ending cash must be a finite number.",
      errors,
    );

    const debtPayments = readArray(
      entry.debt_payments,
      `monthly_plan[${index}].debt_payments`,
      "Monthly debt payments must be provided as an array.",
      errors,
    ).flatMap((payment, paymentIndex) => {
      if (typeof payment !== "object" || payment === null || Array.isArray(payment)) {
        errors.push({
          path: `monthly_plan[${index}].debt_payments[${paymentIndex}]`,
          message: "Monthly debt payments must be objects.",
        });
        return [];
      }

      const debtId = readRequiredText(
        payment.debt_id,
        `monthly_plan[${index}].debt_payments[${paymentIndex}].debt_id`,
        "Monthly debt payments must reference a debt identifier.",
        errors,
      );
      const amount = readNonNegativeNumber(
        payment.amount,
        `monthly_plan[${index}].debt_payments[${paymentIndex}].amount`,
        "Monthly debt payments must include an amount.",
        "Monthly debt payment amounts cannot be negative.",
        "Monthly debt payment amounts must be a finite number.",
        errors,
      );

      if (!debtId || amount === undefined) {
        return [];
      }

      return [
        {
          debt_id: debtId,
          amount,
        },
      ];
    });

    if (month === undefined || startingCash === undefined || endingCash === undefined) {
      return [];
    }

    return [
      {
        month,
        starting_cash: startingCash,
        ending_cash: endingCash,
        debt_payments: debtPayments,
      },
    ];
  });

  const riskFlags = riskFlagInputs.flatMap((riskFlag, index) => {
    if (typeof riskFlag !== "object" || riskFlag === null || Array.isArray(riskFlag)) {
      errors.push({
        path: `risk_flags[${index}]`,
        message: "Risk flags must be objects.",
      });
      return [];
    }

    const summary = readRequiredText(
      riskFlag.summary,
      `risk_flags[${index}].summary`,
      "Risk flags must include a short summary.",
      errors,
    );

    if (!riskFlag.severity || !plannerRiskSeverities.has(riskFlag.severity)) {
      errors.push({
        path: `risk_flags[${index}].severity`,
        message: "Risk flags must use a supported severity.",
      });
    }

    if (!summary || !riskFlag.severity || !plannerRiskSeverities.has(riskFlag.severity)) {
      return [];
    }

    return [
      {
        severity: riskFlag.severity,
        summary,
      },
    ];
  });

  if (
    errors.length > 0 ||
    liquidCash === undefined ||
    monthlyBurn === undefined ||
    runwayMonths === undefined ||
    estimatedMonths === undefined ||
    floorMonths === undefined ||
    !runwayFloorStatuses.has(floorStatus)
  ) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    result: {
      snapshot: {
        liquid_cash: liquidCash,
        monthly_burn: monthlyBurn,
        runway_months: runwayMonths,
      },
      recommended_immediate_actions: recommendedImmediateActions,
      monthly_plan: monthlyPlan,
      runway_estimate: {
        months: estimatedMonths,
        floor_months: floorMonths,
        floor_status: floorStatus,
      },
      assumptions: assumptionsInput,
      risk_flags: riskFlags,
    },
  };
}
