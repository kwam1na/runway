import { access, copyFile, readFile, writeFile } from "node:fs/promises";
import { runAgentWorkflow, type AgentWorkflowOutcome } from "./agents/index.js";
import type { LocalFinancialProfileInput } from "./finance/index.js";

export type InteractiveAssistOptions = {
  profilePath: string;
  ask(question: string): Promise<string>;
  isInteractive: boolean;
};

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
  let profile = await readProfile(options.profilePath);
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
