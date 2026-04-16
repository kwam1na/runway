import type { LocalFinancialProfileInput } from "../finance/index.js";
import { extractStatementText } from "./extract.js";
import type { StatementDebtCandidate, StatementIngestionResult } from "./contracts.js";
import { normalizeStatementText } from "./normalize.js";

type AskFunction = (question: string) => Promise<string>;

type IngestStatementsIntoProfileOptions = {
  profile: LocalFinancialProfileInput;
  statementPaths: string[];
  ask: AskFunction;
  extractStatement?(path: string): Promise<StatementIngestionResult>;
};

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function normalizeLabel(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

async function askYesNo(ask: AskFunction, question: string): Promise<boolean> {
  for (;;) {
    const answer = (await ask(question)).trim().toLowerCase();

    if (["yes", "y"].includes(answer)) {
      return true;
    }

    if (["no", "n"].includes(answer)) {
      return false;
    }
  }
}

async function askOptionalText(
  ask: AskFunction,
  question: string,
  fallback: string,
): Promise<string> {
  const answer = (await ask(question)).trim();
  return answer || fallback;
}

async function askOptionalNumber(
  ask: AskFunction,
  question: string,
  fallback: number | undefined,
): Promise<number | undefined> {
  for (;;) {
    const answer = (await ask(question)).trim();

    if (answer.length === 0) {
      return fallback;
    }

    const value = Number(answer);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
}

async function askAprSelection(
  ask: AskFunction,
  candidate: StatementDebtCandidate,
): Promise<number | undefined> {
  if (candidate.apr_candidates.length === 0) {
    return undefined;
  }

  if (candidate.apr_candidates.length === 1) {
    const apr = candidate.apr_candidates[0]?.apr;
    return askOptionalNumber(
      ask,
      `Runway found APR ${apr !== undefined ? (apr * 100).toFixed(2) : "unknown"}% for "${candidate.label ?? "Debt"}". Press enter to keep it or type a replacement APR decimal.`,
      apr,
    );
  }

  const choices = candidate.apr_candidates
    .map((aprCandidate, index) => `${index + 1}. ${aprCandidate.label ?? "apr"}: ${((aprCandidate.apr ?? 0) * 100).toFixed(2)}%`)
    .join("\n");

  for (;;) {
    const answer = (await ask(
      `Runway found multiple APR candidates for "${candidate.label ?? "Debt"}":\n${choices}\nType the number to use.`,
    )).trim();
    const choice = Number(answer);

    if (Number.isInteger(choice) && choice >= 1 && choice <= candidate.apr_candidates.length) {
      return candidate.apr_candidates[choice - 1]?.apr;
    }
  }
}

async function reviewStatementCandidate(
  ask: AskFunction,
  candidate: StatementDebtCandidate,
  filePath: string,
): Promise<StatementDebtCandidate | null> {
  const defaultLabel = candidate.label ?? "Debt";
  const shouldUseCandidate = await askYesNo(
    ask,
    `Runway found a statement debt candidate for "${defaultLabel}" in ${filePath}. Add or update this debt? (yes/no)`,
  );

  if (!shouldUseCandidate) {
    return null;
  }

  const label = await askOptionalText(
    ask,
    `Runway found label "${defaultLabel}". Press enter to keep it or type a replacement.`,
    defaultLabel,
  );
  const balance = await askOptionalNumber(
    ask,
    `Runway found balance ${candidate.balance !== undefined ? formatCurrency(candidate.balance) : "unknown"} for "${label}". Press enter to keep it or type a replacement.`,
    candidate.balance,
  );
  const minimumPayment = await askOptionalNumber(
    ask,
    `Runway found minimum payment ${candidate.minimum_payment !== undefined ? formatCurrency(candidate.minimum_payment) : "unknown"} for "${label}". Press enter to keep it or type a replacement.`,
    candidate.minimum_payment,
  );
  const selectedApr = await askAprSelection(
    ask,
    {
      ...candidate,
      label,
    },
  );

  return {
    ...candidate,
    label,
    balance,
    minimum_payment: minimumPayment,
    selected_apr: selectedApr,
  };
}

export function mergeConfirmedStatementCandidate(
  profile: LocalFinancialProfileInput,
  candidate: StatementDebtCandidate,
): LocalFinancialProfileInput {
  const debts = profile.debts ? profile.debts.map((debt) => ({ ...debt })) : [];
  const normalizedCandidateLabel = normalizeLabel(candidate.label);
  const existingIndex = debts.findIndex(
    (debt) => normalizeLabel(debt.label) === normalizedCandidateLabel,
  );

  const nextDebt = {
    id: existingIndex >= 0 ? debts[existingIndex]?.id : `debt-${debts.length + 1}`,
    label: candidate.label ?? `Debt ${debts.length + 1}`,
    balance: candidate.balance,
    apr: candidate.selected_apr,
    minimum_payment: candidate.minimum_payment,
  };

  if (existingIndex >= 0) {
    debts[existingIndex] = {
      ...debts[existingIndex],
      ...nextDebt,
    };
  } else {
    debts.push(nextDebt);
  }

  return {
    ...profile,
    debts,
  };
}

export async function ingestStatementsIntoProfile(
  options: IngestStatementsIntoProfileOptions,
): Promise<LocalFinancialProfileInput> {
  const extractStatement = options.extractStatement ?? extractStatementText;
  let profile: LocalFinancialProfileInput = {
    ...options.profile,
    debts: options.profile.debts?.map((debt) => ({ ...debt })),
  };

  for (const statementPath of options.statementPaths) {
    const extracted = await extractStatement(statementPath);
    const candidates =
      extracted.candidates.length > 0
        ? extracted.candidates
        : extracted.raw_text
          ? normalizeStatementText({ filePath: statementPath, rawText: extracted.raw_text })
          : [];

    for (const candidate of candidates) {
      const reviewedCandidate = await reviewStatementCandidate(options.ask, candidate, statementPath);

      if (!reviewedCandidate) {
        continue;
      }

      profile = mergeConfirmedStatementCandidate(profile, reviewedCandidate);
    }
  }

  return profile;
}
