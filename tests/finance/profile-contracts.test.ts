import { describe, expect, it } from "vitest";
import {
  createEmptyPlannerResult,
  normalizeFinancialProfile,
} from "../../src/runway/finance/contracts.js";

describe("financial profile contracts", () => {
  it("normalizes a complete local profile into the canonical planner shape", () => {
    const result = normalizeFinancialProfile({
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
          apr: 0.2399,
          minimum_payment: 220,
        },
      ],
      income_assumptions: {
        expected_monthly_income: 0,
        income_is_confirmed: false,
      },
      planning_preferences: {},
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("expected normalization success");
    }

    expect(result.profile).toEqual({
      cash_position: {
        available_cash: 18000,
        reserved_cash: 2500,
        severance_total: 12000,
        total_liquid_cash: 32500,
      },
      monthly_obligations: {
        essentials: 3200,
        discretionary: 450,
        debt_minimums: 220,
        total_monthly_burn: 3870,
      },
      debts: [
        {
          id: "card-a",
          label: "Card A",
          balance: 6400,
          apr: 0.2399,
          minimum_payment: 220,
        },
      ],
      income_assumptions: {
        expected_monthly_income: 0,
        income_is_confirmed: false,
        notes: [],
      },
      planning_preferences: {
        strategy: "runway-first",
        runway_floor_months: 6,
        prioritize_interest_savings: false,
      },
    });
  });

  it("returns targeted follow-up errors when required debt fields are missing", () => {
    const result = normalizeFinancialProfile({
      cash_position: {
        available_cash: 9000,
        reserved_cash: 1000,
        severance_total: 0,
      },
      monthly_obligations: {
        essentials: 2500,
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

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected normalization failure");
    }

    expect(result.errors).toEqual([
      {
        path: "debts[0].apr",
        message: "Debt APR is required to compare payoff tradeoffs.",
        question: "What APR should runway use for debt \"Card A\"?",
      },
      {
        path: "debts[0].minimum_payment",
        message: "Debt minimum payment is required to protect the monthly runway floor.",
        question: "What is the minimum monthly payment for debt \"Card A\"?",
      },
    ]);
  });

  it("rejects impossible negative values instead of silently normalizing them", () => {
    const result = normalizeFinancialProfile({
      cash_position: {
        available_cash: -1,
        reserved_cash: 0,
        severance_total: 0,
      },
      monthly_obligations: {
        essentials: -100,
      },
      debts: [],
      income_assumptions: {},
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected normalization failure");
    }

    expect(result.errors).toEqual([
      {
        path: "cash_position.available_cash",
        message: "Available cash cannot be negative.",
      },
      {
        path: "monthly_obligations.essentials",
        message: "Essential monthly obligations cannot be negative.",
      },
    ]);
  });

  it("defines a planner result shape with explicit defaults for downstream tickets", () => {
    const result = createEmptyPlannerResult();

    expect(result).toEqual({
      snapshot: {
        liquid_cash: 0,
        monthly_burn: 0,
        runway_months: 0,
      },
      recommended_immediate_actions: [],
      monthly_plan: [],
      runway_estimate: {
        months: 0,
        floor_months: 6,
        floor_status: "unknown",
      },
      assumptions: [],
      risk_flags: [],
    });
  });
});
