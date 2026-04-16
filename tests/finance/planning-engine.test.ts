import { describe, expect, it } from "vitest";
import type { NormalizedFinancialProfile } from "../../src/runway/finance/contracts.js";
import { buildRunwayPlan } from "../../src/runway/finance/planning-engine.js";

function createProfile(overrides: Partial<NormalizedFinancialProfile> = {}): NormalizedFinancialProfile {
  return {
    cash_position: {
      available_cash: 18000,
      reserved_cash: 2500,
      severance_total: 12000,
      total_liquid_cash: 32500,
      ...overrides.cash_position,
    },
    monthly_obligations: {
      essentials: 3200,
      discretionary: 450,
      debt_minimums: 220,
      total_monthly_burn: 3870,
      ...overrides.monthly_obligations,
    },
    debts:
      overrides.debts ??
      [
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
      ...overrides.income_assumptions,
    },
    planning_preferences: {
      strategy: "runway-first",
      runway_floor_months: 6,
      prioritize_interest_savings: false,
      ...overrides.planning_preferences,
    },
  };
}

describe("runway planning engine", () => {
  it("preserves cash and recommends minimums when obligations are manageable", () => {
    const result = buildRunwayPlan(createProfile());

    expect(result.runway_estimate.floor_status).toBe("meets-floor");
    expect(result.recommended_immediate_actions).toContainEqual(
      expect.objectContaining({
        type: "pay-minimums",
      }),
    );
    expect(result.recommended_immediate_actions).not.toContainEqual(
      expect.objectContaining({
        type: "pay-extra-debt",
      }),
    );
    expect(result.snapshot.runway_months).toBeGreaterThan(6);
    expect(result.monthly_plan[0]).toMatchObject({
      month: 1,
      debt_payments: [{ debt_id: "card-a", amount: 220 }],
    });
    expect(result.risk_flags).toEqual([]);
  });

  it("rejects extra debt payoff candidates that would breach the runway floor", () => {
    const result = buildRunwayPlan(
      createProfile({
        cash_position: {
          available_cash: 9000,
          reserved_cash: 2000,
          severance_total: 8000,
          total_liquid_cash: 19000,
        },
        monthly_obligations: {
          essentials: 2500,
          discretionary: 200,
          debt_minimums: 200,
          total_monthly_burn: 2900,
        },
        debts: [
          {
            id: "card-a",
            label: "Card A",
            balance: 8000,
            apr: 0.2899,
            minimum_payment: 200,
          },
        ],
      }),
    );

    expect(result.runway_estimate.floor_status).toBe("meets-floor");
    expect(result.recommended_immediate_actions).not.toContainEqual(
      expect.objectContaining({
        type: "pay-extra-debt",
      }),
    );
    expect(result.assumptions).toContain(
      "Extra debt paydown is only recommended when the runway floor remains protected.",
    );
  });

  it("produces the same recommendation every time for the same normalized profile", () => {
    const profile = createProfile();

    expect(buildRunwayPlan(profile)).toEqual(buildRunwayPlan(profile));
  });

  it("surfaces structurally unsafe runway situations with explicit warnings", () => {
    const result = buildRunwayPlan(
      createProfile({
        cash_position: {
          available_cash: 4000,
          reserved_cash: 1000,
          severance_total: 2000,
          total_liquid_cash: 7000,
        },
        monthly_obligations: {
          essentials: 3500,
          discretionary: 500,
          debt_minimums: 300,
          total_monthly_burn: 4300,
        },
        debts: [
          {
            id: "card-a",
            label: "Card A",
            balance: 5000,
            apr: 0.24,
            minimum_payment: 300,
          },
        ],
      }),
    );

    expect(result.runway_estimate.floor_status).toBe("below-floor");
    expect(result.risk_flags).toContainEqual(
      expect.objectContaining({
        severity: "warning",
      }),
    );
    expect(result.risk_flags[0]?.summary).toContain("runway floor");
  });
});
