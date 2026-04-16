import { basename, extname } from "node:path";
import type { StatementAprCandidate, StatementDebtCandidate } from "./contracts.js";

type NormalizeStatementTextInput = {
  filePath: string;
  rawText: string;
};

function normalizeCurrency(value: string): number {
  return Number(value.replaceAll(",", ""));
}

function findLineValue(rawText: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(rawText);
  return match?.[1]?.trim();
}

function findCurrency(rawText: string, labels: RegExp[]): { value?: number; snippet?: string } {
  for (const label of labels) {
    const match = label.exec(rawText);

    if (match?.[1]) {
      return {
        value: normalizeCurrency(match[1]),
        snippet: match[0],
      };
    }
  }

  return {};
}

function normalizeAprCandidates(rawText: string): StatementAprCandidate[] {
  return rawText
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = /(.*?)(\d{1,2}(?:\.\d+)?)%/.exec(line);

      if (!match || !/apr|interest/i.test(line)) {
        return [];
      }

      const label = match[1].trim().replace(/[:\-]+$/, "").toLowerCase();
      return [
        {
          label: label || undefined,
          apr: Number((Number(match[2]) / 100).toFixed(4)),
          confidence: /apr/i.test(line) ? "high" : "medium",
          snippet: {
            text: line.trim(),
          },
        } satisfies StatementAprCandidate,
      ];
    });
}

export function normalizeStatementText(input: NormalizeStatementTextInput): StatementDebtCandidate[] {
  const rawText = input.rawText.trim();

  if (rawText.length === 0) {
    return [];
  }

  const accountTail = findLineValue(rawText, /(?:account ending in|ending in|account #)\s*(\d{4})/i);
  const statementDate = findLineValue(rawText, /statement date[: ]+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i);
  const dueDate = findLineValue(rawText, /(?:payment due date|due date)[: ]+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i);
  const balance = findCurrency(rawText, [
    /(?:new balance|statement balance|current balance)[^\d$]*\$?([0-9][0-9,]*(?:\.\d{2})?)/i,
  ]);
  const minimumPayment = findCurrency(rawText, [
    /(?:minimum payment due|minimum payment)[^\d$]*\$?([0-9][0-9,]*(?:\.\d{2})?)/i,
  ]);
  const aprCandidates = normalizeAprCandidates(rawText);
  const firstLine = rawText.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim();
  const fileLabel = basename(input.filePath, extname(input.filePath)).trim();

  return [
    {
      issuer: firstLine,
      label: fileLabel || undefined,
      account_tail: accountTail,
      statement_date: statementDate,
      due_date: dueDate,
      balance: balance.value,
      minimum_payment: minimumPayment.value,
      apr_candidates: aprCandidates,
      field_sources: {
        label: fileLabel
          ? {
              text: fileLabel,
            }
          : undefined,
        balance: balance.snippet
          ? {
              text: balance.snippet,
            }
          : undefined,
        minimum_payment: minimumPayment.snippet
          ? {
              text: minimumPayment.snippet,
            }
          : undefined,
      },
    },
  ];
}
