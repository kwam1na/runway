import {
  analyzeProfilePayload,
  type AnalysisSuccess,
  type LocalFinancialProfileInput,
  type ValidationIssue,
} from "../finance/index.js";

export type AgentWorkflowNeedsInput = {
  status: "needs-input";
  profile: LocalFinancialProfileInput;
  validationIssues: ValidationIssue[];
  followUpQuestions: ValidationIssue[];
};

export type AgentWorkflowReady = {
  status: "ready";
  profile: LocalFinancialProfileInput;
  analysis: AnalysisSuccess;
  result: AnalysisSuccess["result"];
  report: string;
};

export type AgentWorkflowOutcome = AgentWorkflowNeedsInput | AgentWorkflowReady;

function mergeOptionalSection<T extends Record<string, unknown>>(
  baseSection: T | undefined,
  patchSection: T | undefined,
): T | undefined {
  if (!baseSection && !patchSection) {
    return undefined;
  }

  return {
    ...baseSection,
    ...patchSection,
  } as T;
}

function mergeDebtPatch(
  baseDebts: LocalFinancialProfileInput["debts"],
  patchDebts: LocalFinancialProfileInput["debts"],
): LocalFinancialProfileInput["debts"] {
  if (!patchDebts) {
    return baseDebts?.map((debt) => ({ ...debt }));
  }

  if (!baseDebts || baseDebts.length === 0) {
    return patchDebts.map((debt) => ({ ...debt }));
  }

  const merged = baseDebts.map((debt) => ({ ...debt }));

  patchDebts.forEach((patchDebt, index) => {
    const targetIndex =
      patchDebt.id !== undefined
        ? merged.findIndex((debt) => debt.id === patchDebt.id)
        : index < merged.length
          ? index
          : -1;

    if (targetIndex >= 0) {
      merged[targetIndex] = {
        ...merged[targetIndex],
        ...patchDebt,
      };
      return;
    }

    merged.push({ ...patchDebt });
  });

  return merged;
}

export function mergeFinancialProfilePatch(
  profile: LocalFinancialProfileInput,
  patch?: LocalFinancialProfileInput,
): LocalFinancialProfileInput {
  if (!patch) {
    return {
      ...profile,
      cash_position: profile.cash_position ? { ...profile.cash_position } : undefined,
      monthly_obligations: profile.monthly_obligations ? { ...profile.monthly_obligations } : undefined,
      debts: profile.debts?.map((debt) => ({ ...debt })),
      income_assumptions: profile.income_assumptions
        ? {
            ...profile.income_assumptions,
            notes: profile.income_assumptions.notes ? [...profile.income_assumptions.notes] : undefined,
          }
        : undefined,
      planning_preferences: profile.planning_preferences ? { ...profile.planning_preferences } : undefined,
    };
  }

  return {
    ...profile,
    ...patch,
    cash_position: mergeOptionalSection(profile.cash_position, patch.cash_position),
    monthly_obligations: mergeOptionalSection(profile.monthly_obligations, patch.monthly_obligations),
    debts: mergeDebtPatch(profile.debts, patch.debts),
    income_assumptions:
      !profile.income_assumptions && !patch.income_assumptions
        ? undefined
        : {
            ...profile.income_assumptions,
            ...patch.income_assumptions,
            notes: patch.income_assumptions?.notes
              ? [...patch.income_assumptions.notes]
              : profile.income_assumptions?.notes
                ? [...profile.income_assumptions.notes]
                : undefined,
          },
    planning_preferences: mergeOptionalSection(
      profile.planning_preferences,
      patch.planning_preferences,
    ),
  };
}

export function runAgentWorkflow(
  profile: LocalFinancialProfileInput,
  patch?: LocalFinancialProfileInput,
): AgentWorkflowOutcome {
  const mergedProfile = mergeFinancialProfilePatch(profile, patch);
  const analysis = analyzeProfilePayload(mergedProfile);

  if (!analysis.ok) {
    return {
      status: "needs-input",
      profile: mergedProfile,
      validationIssues: analysis.errors,
      followUpQuestions: analysis.errors.filter((issue) => issue.question !== undefined),
    };
  }

  return {
    status: "ready",
    profile: mergedProfile,
    analysis,
    result: analysis.result,
    report: analysis.report,
  };
}
