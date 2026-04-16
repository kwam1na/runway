import { readFile, writeFile } from "node:fs/promises";
import { runAgentWorkflow, type AgentWorkflowOutcome } from "./agents/index.js";
import type { LocalFinancialProfileInput } from "./finance/index.js";

export type InteractiveAssistOptions = {
  profilePath: string;
  ask(question: string): Promise<string>;
  isInteractive: boolean;
};

async function readProfile(profilePath: string): Promise<LocalFinancialProfileInput> {
  return JSON.parse(await readFile(profilePath, "utf8")) as LocalFinancialProfileInput;
}

async function writeProfile(profilePath: string, profile: LocalFinancialProfileInput): Promise<void> {
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

function applyAprAnswer(
  profile: LocalFinancialProfileInput,
  answer: string,
): LocalFinancialProfileInput {
  const trimmed = answer.trim();

  if (trimmed.length === 0) {
    throw new Error("Interactive assist needs a finite numeric APR answer.");
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    throw new Error("Interactive assist needs a finite numeric APR answer.");
  }

  const debts = profile.debts ? profile.debts.map((debt) => ({ ...debt })) : [];

  if (!debts[0]) {
    throw new Error("Interactive assist cannot update debts[0].apr because no first debt exists.");
  }

  debts[0] = {
    ...debts[0],
    apr: value,
  };

  return {
    ...profile,
    debts,
  };
}

export async function runInteractiveAssist(
  options: InteractiveAssistOptions,
): Promise<AgentWorkflowOutcome> {
  let profile = await readProfile(options.profilePath);
  let outcome = runAgentWorkflow(profile);

  if (!options.isInteractive || outcome.status !== "needs-input") {
    return outcome;
  }

  const nextQuestion = outcome.followUpQuestions[0];

  if (!nextQuestion) {
    throw new Error("Interactive assist needs at least one follow-up question.");
  }

  if (nextQuestion.path !== "debts[0].apr") {
    throw new Error(`Interactive assist cannot handle path: ${nextQuestion.path}`);
  }

  const answer = await options.ask(nextQuestion.question);
  profile = applyAprAnswer(profile, answer);
  await writeProfile(options.profilePath, profile);
  outcome = runAgentWorkflow(profile);

  return outcome;
}
