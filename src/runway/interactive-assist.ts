import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runAgentWorkflow, type AgentWorkflowOutcome } from "./agents/index.js";
import type { LocalFinancialProfileInput } from "./finance/index.js";
import { ingestStatementsIntoProfile } from "./statement-intake/index.js";

export type InteractiveAssistOptions = {
  profilePath: string;
  ask(question: string): Promise<string>;
  isInteractive: boolean;
  statementPaths?: string[];
};

const DEFAULT_RUNWAY_FLOOR_MONTHS = 6;

type AnswerApplication =
  | {
      kind: "applied";
      profile: LocalFinancialProfileInput;
    }
  | {
      kind: "retry";
    }
  | {
      kind: "unsupported";
    };

async function readProfile(profilePath: string): Promise<LocalFinancialProfileInput> {
  return JSON.parse(await readFile(profilePath, "utf8")) as LocalFinancialProfileInput;
}

async function writeProfile(profilePath: string, profile: LocalFinancialProfileInput): Promise<void> {
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

async function ensureBackup(profilePath: string): Promise<void> {
  const backupPath = `${profilePath}.bak`;

  try {
    await access(backupPath);
    return;
  } catch {
    await copyFile(profilePath, backupPath);
  }
}

function parseNumericAnswer(answer: string): number | undefined {
  const trimmed = answer.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function parseBooleanAnswer(answer: string): boolean | undefined {
  const normalized = answer.trim().toLowerCase();

  if (["true", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function askNonNegativeNumber(
  ask: InteractiveAssistOptions["ask"],
  question: string,
): Promise<number> {
  for (;;) {
    const value = parseNumericAnswer(await ask(question));

    if (value !== undefined && value >= 0) {
      return value;
    }
  }
}

async function askNonNegativeInteger(
  ask: InteractiveAssistOptions["ask"],
  question: string,
): Promise<number> {
  for (;;) {
    const value = parseNumericAnswer(await ask(question));

    if (value !== undefined && value >= 0 && Number.isInteger(value)) {
      return value;
    }
  }
}

async function askBoolean(
  ask: InteractiveAssistOptions["ask"],
  question: string,
): Promise<boolean> {
  for (;;) {
    const value = parseBooleanAnswer(await ask(question));

    if (value !== undefined) {
      return value;
    }
  }
}

async function askDebtLabel(
  ask: InteractiveAssistOptions["ask"],
  index: number,
): Promise<string> {
  const defaultLabel = `Debt ${index + 1}`;
  const answer = (await ask(
    `What should runway call debt ${index + 1}? Leave blank to use "${defaultLabel}".`,
  )).trim();

  return answer || defaultLabel;
}

function cloneProfile(profile: LocalFinancialProfileInput): LocalFinancialProfileInput {
  return {
    ...profile,
    cash_position: profile.cash_position ? { ...profile.cash_position } : undefined,
    monthly_obligations: profile.monthly_obligations ? { ...profile.monthly_obligations } : undefined,
    debts: profile.debts?.map((debt) => ({ ...debt })),
    income_assumptions: profile.income_assumptions ? { ...profile.income_assumptions } : undefined,
    planning_preferences: profile.planning_preferences ? { ...profile.planning_preferences } : undefined,
  };
}

async function completeCashPositionStage(
  profile: LocalFinancialProfileInput,
  ask: InteractiveAssistOptions["ask"],
): Promise<LocalFinancialProfileInput> {
  const cashPosition = { ...profile.cash_position };

  if (cashPosition.available_cash === undefined) {
    cashPosition.available_cash = await askNonNegativeNumber(
      ask,
      "How much available cash can runway use right now?",
    );
  }

  if (cashPosition.reserved_cash === undefined) {
    cashPosition.reserved_cash = await askNonNegativeNumber(
      ask,
      "How much cash should stay reserved?",
    );
  }

  if (cashPosition.severance_total === undefined) {
    cashPosition.severance_total = await askNonNegativeNumber(
      ask,
      "How much severance cash is available?",
    );
  }

  return {
    ...profile,
    cash_position: {
      ...cashPosition,
    },
  };
}

async function completeMonthlyObligationsStage(
  profile: LocalFinancialProfileInput,
  ask: InteractiveAssistOptions["ask"],
): Promise<LocalFinancialProfileInput> {
  const monthlyObligations = { ...profile.monthly_obligations };

  if (monthlyObligations.essentials === undefined) {
    monthlyObligations.essentials = await askNonNegativeNumber(
      ask,
      "What are the essential monthly obligations?",
    );
  }

  if (monthlyObligations.discretionary === undefined) {
    monthlyObligations.discretionary = await askNonNegativeNumber(
      ask,
      "What are the discretionary monthly obligations? Enter 0 if none.",
    );
  }

  return {
    ...profile,
    monthly_obligations: {
      ...monthlyObligations,
    },
  };
}

async function completeDebtCollectionStage(
  profile: LocalFinancialProfileInput,
  ask: InteractiveAssistOptions["ask"],
): Promise<LocalFinancialProfileInput> {
  if (profile.debts !== undefined) {
    return profile;
  }

  const debtCount = await askNonNegativeInteger(ask, "How many debts should runway track?");
  const debts: NonNullable<LocalFinancialProfileInput["debts"]> = [];

  for (let index = 0; index < debtCount; index += 1) {
    const label = await askDebtLabel(ask, index);
    const balance = await askNonNegativeNumber(
      ask,
      `What is the current balance for debt "${label}"?`,
    );
    const apr = await askNonNegativeNumber(
      ask,
      `What APR should runway use for debt "${label}"?`,
    );
    const minimumPayment = await askNonNegativeNumber(
      ask,
      `What is the minimum monthly payment for debt "${label}"?`,
    );

    debts.push({
      id: `debt-${index + 1}`,
      label,
      balance,
      apr,
      minimum_payment: minimumPayment,
    });
  }

  return {
    ...profile,
    debts,
  };
}

async function completeIncomeAssumptionsStage(
  profile: LocalFinancialProfileInput,
  ask: InteractiveAssistOptions["ask"],
): Promise<LocalFinancialProfileInput> {
  const incomeAssumptions = { ...profile.income_assumptions };
  const askedExpectedMonthlyIncome = incomeAssumptions.expected_monthly_income === undefined;

  if (askedExpectedMonthlyIncome) {
    incomeAssumptions.expected_monthly_income = await askNonNegativeNumber(
      ask,
      "What expected monthly income should runway include before confirmation? Enter 0 if none.",
    );
  }

  const expectedMonthlyIncome = incomeAssumptions.expected_monthly_income;

  if (
    expectedMonthlyIncome !== undefined &&
    expectedMonthlyIncome > 0 &&
    incomeAssumptions.income_is_confirmed === undefined
  ) {
    incomeAssumptions.income_is_confirmed = await askBoolean(
      ask,
      "Is the expected monthly income confirmed enough to include in runway planning?",
    );
  } else if (
    askedExpectedMonthlyIncome &&
    expectedMonthlyIncome === 0 &&
    incomeAssumptions.income_is_confirmed === undefined
  ) {
    incomeAssumptions.income_is_confirmed = false;
  }

  return {
    ...profile,
    income_assumptions: {
      ...incomeAssumptions,
    },
  };
}

function withBootstrapPlanningPreferences(
  profile: LocalFinancialProfileInput,
): LocalFinancialProfileInput {
  return {
    ...profile,
    planning_preferences: {
      strategy: "runway-first",
      runway_floor_months: DEFAULT_RUNWAY_FLOOR_MONTHS,
      prioritize_interest_savings: false,
      ...profile.planning_preferences,
    },
  };
}

async function bootstrapProfileStages(
  profile: LocalFinancialProfileInput,
  ask: InteractiveAssistOptions["ask"],
): Promise<LocalFinancialProfileInput> {
  const needsBootstrap =
    profile.cash_position?.available_cash === undefined ||
    profile.cash_position?.reserved_cash === undefined ||
    profile.cash_position?.severance_total === undefined ||
    profile.monthly_obligations?.essentials === undefined ||
    profile.monthly_obligations?.discretionary === undefined ||
    profile.debts === undefined ||
    profile.income_assumptions?.expected_monthly_income === undefined;
  let nextProfile = cloneProfile(profile);
  nextProfile = await completeCashPositionStage(nextProfile, ask);
  nextProfile = await completeMonthlyObligationsStage(nextProfile, ask);
  nextProfile = await completeDebtCollectionStage(nextProfile, ask);
  nextProfile = await completeIncomeAssumptionsStage(nextProfile, ask);

  return needsBootstrap ? withBootstrapPlanningPreferences(nextProfile) : nextProfile;
}

async function readOrInitializeProfile(
  profilePath: string,
): Promise<{ exists: true; profile: LocalFinancialProfileInput } | { exists: false; profile: {} }> {
  try {
    return {
      exists: true,
      profile: await readProfile(profilePath),
    };
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }

    return {
      exists: false,
      profile: {},
    };
  }
}

export function buildStatementIngestionRequest(args: string[]): {
  profilePath?: string;
  statementPaths: string[];
} {
  const markerIndex = args.indexOf("--statements");
  const positionalArgs = markerIndex >= 0 ? args.slice(0, markerIndex) : args;

  return {
    profilePath: positionalArgs[0],
    statementPaths: markerIndex >= 0 ? args.slice(markerIndex + 1) : [],
  };
}

export async function resolveDefaultProfilePath(cwd = process.cwd()): Promise<string> {
  const baseName = "runway-profile";

  for (let suffix = 0; suffix < 10_000; suffix += 1) {
    const filename = suffix === 0 ? `${baseName}.json` : `${baseName}-${suffix + 1}.json`;
    const candidatePath = resolve(cwd, filename);

    try {
      await access(candidatePath);
    } catch {
      return candidatePath;
    }
  }

  throw new Error("Unable to find an available default profile path.");
}

function applyDebtAnswer(
  profile: LocalFinancialProfileInput,
  path: string,
  answer: string,
): AnswerApplication {
  const match = /^debts\[(\d+)\]\.(apr|minimum_payment)$/.exec(path);

  if (!match) {
    return {
      kind: "unsupported",
    };
  }

  const index = Number(match[1]);
  const field = match[2] as "apr" | "minimum_payment";
  const value = parseNumericAnswer(answer);

  if (value === undefined) {
    return {
      kind: "retry",
    };
  }

  const debts = profile.debts ? profile.debts.map((debt) => ({ ...debt })) : [];
  const debt = debts[index];

  if (!debt) {
    throw new Error(`Interactive assist cannot update ${path} because no debt exists at index ${index}.`);
  }

  debts[index] = {
    ...debt,
    [field]: value,
  };

  return {
    kind: "applied",
    profile: {
      ...profile,
      debts,
    },
  };
}

function applyAnswer(
  profile: LocalFinancialProfileInput,
  path: string,
  answer: string,
): AnswerApplication {
  const debtAnswer = applyDebtAnswer(profile, path, answer);
  if (debtAnswer.kind !== "unsupported") {
    return debtAnswer;
  }

  if (path === "income_assumptions.income_is_confirmed") {
    const value = parseBooleanAnswer(answer);
    if (value === undefined) {
      return {
        kind: "retry",
      };
    }

    return {
      kind: "applied",
      profile: {
        ...profile,
        income_assumptions: {
          ...profile.income_assumptions,
          income_is_confirmed: value,
        },
      },
    };
  }

  throw new Error(`Interactive assist cannot handle path: ${path}`);
}

export async function runInteractiveAssist(
  options: InteractiveAssistOptions,
): Promise<AgentWorkflowOutcome> {
  const initialProfileState = await readOrInitializeProfile(options.profilePath);
  let profile = await bootstrapProfileStages(initialProfileState.profile, options.ask);

  if (
    !initialProfileState.exists ||
    JSON.stringify(profile) !== JSON.stringify(initialProfileState.profile)
  ) {
    if (initialProfileState.exists) {
      await ensureBackup(options.profilePath);
    }

    await writeProfile(options.profilePath, profile);
  }

  if (options.statementPaths && options.statementPaths.length > 0) {
    const reviewedProfile = await ingestStatementsIntoProfile({
      profile,
      statementPaths: options.statementPaths,
      ask: options.ask,
    });

    if (JSON.stringify(reviewedProfile) !== JSON.stringify(profile)) {
      await ensureBackup(options.profilePath);
      profile = reviewedProfile;
      await writeProfile(options.profilePath, profile);
    }
  }

  let outcome = runAgentWorkflow(profile);

  if (!options.isInteractive || outcome.status !== "needs-input") {
    return outcome;
  }

  while (outcome.status === "needs-input") {
    const nextQuestion = outcome.followUpQuestions[0];

    if (!nextQuestion || !nextQuestion.question) {
      return outcome;
    }

    for (;;) {
      const answer = await options.ask(nextQuestion.question);
      const updatedProfile = applyAnswer(profile, nextQuestion.path, answer);

      if (updatedProfile.kind === "retry") {
        continue;
      }

      if (updatedProfile.kind === "unsupported") {
        throw new Error(`Interactive assist cannot handle path: ${nextQuestion.path}`);
      }

      await ensureBackup(options.profilePath);
      profile = updatedProfile.profile;
      await writeProfile(options.profilePath, profile);
      outcome = runAgentWorkflow(profile);
      break;
    }
  }

  return outcome;
}
