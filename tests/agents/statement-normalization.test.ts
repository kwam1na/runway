import { describe, expect, it } from "vitest";
import {
  normalizeStatementText,
} from "../../src/runway/statement-intake/normalize.js";
import { mergeConfirmedStatementCandidate } from "../../src/runway/statement-intake/review.js";

describe("statement normalization", () => {
  it("extracts debt fields and apr candidates from statement text", () => {
    const [candidate] = normalizeStatementText({
      filePath: "/tmp/chase-card.pdf",
      rawText: `CHASE\nAccount ending in 1234\nStatement Date 04/01/2026\nPayment Due Date 04/25/2026\nNew Balance $6,400.00\nMinimum Payment Due $220.00\nPurchase APR 23.99%\nPenalty APR 29.99%`,
    });

    expect(candidate).toMatchObject({
      issuer: "CHASE",
      label: "chase-card",
      account_tail: "1234",
      statement_date: "04/01/2026",
      due_date: "04/25/2026",
      balance: 6400,
      minimum_payment: 220,
    });
    expect(candidate.apr_candidates).toEqual([
      expect.objectContaining({ label: "purchase apr", apr: 0.2399 }),
      expect.objectContaining({ label: "penalty apr", apr: 0.2999 }),
    ]);
  });

  it("updates an existing debt when the confirmed label matches", () => {
    const nextProfile = mergeConfirmedStatementCandidate(
      {
        debts: [
          {
            id: "card-a",
            label: "Chase Card",
            balance: 10,
            apr: 0.2,
            minimum_payment: 25,
          },
        ],
      },
      {
        label: "Chase Card",
        balance: 6400,
        minimum_payment: 220,
        selected_apr: 0.2399,
        apr_candidates: [],
      },
    );

    expect(nextProfile).toMatchObject({
      debts: [
        {
          id: "card-a",
          label: "Chase Card",
          balance: 6400,
          apr: 0.2399,
          minimum_payment: 220,
        },
      ],
    });
  });
});
