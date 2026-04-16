import { describe, expect, it } from "vitest";
import { mergeFinancialProfilePatch, runAgentWorkflow } from "../../src/runway/agents/index.js";

describe("agent workflow", () => {
  it("returns deterministic follow-up questions for an incomplete profile", () => {
    const outcome = runAgentWorkflow({
      cash_position: {
        available_cash: 18000,
        reserved_cash: 2500,
        severance_total: 12000,
      },
      monthly_obligations: {
        essentials: 3200,
      },
      debts: [
        {
          id: "card-a",
          label: "Card A",
          balance: 6400,
        },
      ],
      income_assumptions: {},
    });

    expect(outcome).toEqual({
      status: "needs-input",
      profile: {
        cash_position: {
          available_cash: 18000,
          reserved_cash: 2500,
          severance_total: 12000,
        },
        monthly_obligations: {
          essentials: 3200,
        },
        debts: [
          {
            id: "card-a",
            label: "Card A",
            balance: 6400,
          },
        ],
        income_assumptions: {},
      },
      validationIssues: [
        {
          path: "debts[0].apr",
          message: "Debt APR is required to compare payoff tradeoffs.",
          question: 'What APR should runway use for debt "Card A"?',
        },
        {
          path: "debts[0].minimum_payment",
          message: "Debt minimum payment is required to protect the monthly runway floor.",
          question: 'What is the minimum monthly payment for debt "Card A"?',
        },
      ],
      followUpQuestions: [
        {
          path: "debts[0].apr",
          message: "Debt APR is required to compare payoff tradeoffs.",
          question: 'What APR should runway use for debt "Card A"?',
        },
        {
          path: "debts[0].minimum_payment",
          message: "Debt minimum payment is required to protect the monthly runway floor.",
          question: 'What is the minimum monthly payment for debt "Card A"?',
        },
      ],
    });
  });

  it("merges a local answer patch and returns the shared completed analysis", () => {
    const outcome = runAgentWorkflow(
      {
        cash_position: {
          available_cash: 18000,
          reserved_cash: 2500,
          severance_total: 12000,
        },
        monthly_obligations: {
          essentials: 3200,
          discretionary: 450,
        },
        debts: [
          {
            id: "card-a",
            label: "Card A",
            balance: 6400,
          },
        ],
        income_assumptions: {
          expected_monthly_income: 0,
          income_is_confirmed: false,
        },
      },
      {
        debts: [
          {
            id: "card-a",
            apr: 0.2399,
            minimum_payment: 220,
          },
        ],
      },
    );

    expect(outcome.status).toBe("ready");

    if (outcome.status !== "ready") {
      throw new Error("expected ready outcome");
    }

    expect(outcome.profile.debts).toEqual([
      {
        id: "card-a",
        label: "Card A",
        balance: 6400,
        apr: 0.2399,
        minimum_payment: 220,
      },
    ]);
    expect(outcome.result.runway_estimate.floor_status).toBe("meets-floor");
    expect(outcome.report).toContain("# Runway Analysis");
  });

  it("merges debt answers by id without discarding untouched fields", () => {
    const merged = mergeFinancialProfilePatch(
      {
        debts: [
          {
            id: "card-a",
            label: "Card A",
            balance: 6400,
          },
        ],
      },
      {
        debts: [
          {
            id: "card-a",
            apr: 0.2399,
            minimum_payment: 220,
          },
        ],
      },
    );

    expect(merged).toEqual({
      debts: [
        {
          id: "card-a",
          label: "Card A",
          balance: 6400,
          apr: 0.2399,
          minimum_payment: 220,
        },
      ],
    });
  });
});
