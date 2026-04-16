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

async function bootstrapProfile(
  profilePath: string,
  ask: InteractiveAssistOptions["ask"],
): Promise<LocalFinancialProfileInput> {
  const availableCash = await askNonNegativeNumber(
    ask,
    "How much available cash can runway use right now?",
  );
  const reservedCash = await askNonNegativeNumber(
    ask,
    "How much cash should stay reserved?",
  );
  const severanceTotal = await askNonNegativeNumber(
    ask,
    "How much severance cash is available?",
  );
  const essentials = await askNonNegativeNumber(
    ask,
    "What are the essential monthly obligations?",
  );
  const discretionary = await askNonNegativeNumber(
    ask,
    "What are the discretionary monthly obligations? Enter 0 if none.",
  );
  const debtCount = await askNonNegativeInteger(
    ask,
    "How many debts should runway track?",
  );

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

  const expectedMonthlyIncome = await askNonNegativeNumber(
    ask,
    "What expected monthly income should runway include before confirmation? Enter 0 if none.",
  );
  const incomeIsConfirmed =
    expectedMonthlyIncome > 0
      ? await askBoolean(
          ask,
          "Is the expected monthly income confirmed enough to include in runway planning?",
        )
      : false;

  const profile: LocalFinancialProfileInput = {
    cash_position: {
      available_cash: availableCash,
      reserved_cash: reservedCash,
      severance_total: severanceTotal,
    },
    monthly_obligations: {
      essentials,
      discretionary,
    },
    debts,
    income_assumptions: {
      expected_monthly_income: expectedMonthlyIncome,
      income_is_confirmed: incomeIsConfirmed,
    },
    planning_preferences: {
      strategy: "runway-first",
      runway_floor_months: DEFAULT_RUNWAY_FLOOR_MONTHS,
      prioritize_interest_savings: false,
    },
  };

  await writeProfile(profilePath, profile);
  return profile;
}

async function readOrBootstrapProfile(
  profilePath: string,
  ask: InteractiveAssistOptions["ask"],
): Promise<LocalFinancialProfileInput> {
  try {
    return await readProfile(profilePath);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }

    return bootstrapProfile(profilePath, ask);
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
  let profile = await readOrBootstrapProfile(options.profilePath, options.ask);

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
