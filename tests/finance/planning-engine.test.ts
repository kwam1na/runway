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
    expect(result.snapshot.runway_months).toBeGreaterThan(6);
    expect(result.monthly_plan[0]).toMatchObject({
      month: 1,
      debt_payments: [{ debt_id: "card-a", amount: 220 }],
    });
    expect(result.risk_flags).toEqual([]);
  });

  it("uses surplus cash for partial high-apr paydown when it does not reduce survivable whole months", () => {
    const result = buildRunwayPlan(
      createProfile({
        cash_position: {
          available_cash: 14500,
          reserved_cash: 2500,
          severance_total: 12000,
          total_liquid_cash: 29000,
        },
        monthly_obligations: {
          essentials: 3000,
          discretionary: 400,
          debt_minimums: 200,
          total_monthly_burn: 3600,
        },
        debts: [
          {
            id: "card-a",
            label: "Card A",
            balance: 5000,
            apr: 0.2999,
            minimum_payment: 200,
          },
        ],
      }),
    );

    expect(result.snapshot.runway_months).toBe(8);
    expect(result.recommended_immediate_actions).toContainEqual(
      expect.objectContaining({
        type: "pay-extra-debt",
        amount: 200,
      }),
    );
    expect(result.monthly_plan[0]?.debt_payments).toEqual([{ debt_id: "card-a", amount: 200 }]);
  });

  it("rejects extra debt payoff candidates that would breach the runway floor", () => {
    const result = buildRunwayPlan(
      createProfile({
        cash_position: {
          available_cash: 7400,
          reserved_cash: 2000,
          severance_total: 8000,
          total_liquid_cash: 17400,
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
      "Extra debt paydown is only recommended when survivable whole-month runway does not drop.",
    );
  });

  it("produces the same recommendation every time for the same normalized profile", () => {
    const profile = createProfile();

    expect(buildRunwayPlan(profile)).toEqual(buildRunwayPlan(profile));
  });

  it("handles larger debt lists without changing the deterministic recommendation contract", () => {
    const debts = Array.from({ length: 12 }, (_, index) => ({
      id: `card-${index + 1}`,
      label: `Card ${index + 1}`,
      balance: 800 + index * 150,
      apr: 0.12 + index * 0.01,
      minimum_payment: 40 + index * 5,
    }));

    const result = buildRunwayPlan(
      createProfile({
        cash_position: {
          available_cash: 28000,
          reserved_cash: 3000,
          severance_total: 15000,
          total_liquid_cash: 46000,
        },
        monthly_obligations: {
          essentials: 2600,
          discretionary: 250,
          debt_minimums: debts.reduce((sum, debt) => sum + debt.minimum_payment, 0),
          total_monthly_burn: 2600 + 250 + debts.reduce((sum, debt) => sum + debt.minimum_payment, 0),
        },
        debts,
      }),
    );

    expect(result.runway_estimate.floor_status).toBe("meets-floor");
    expect(result.recommended_immediate_actions[0]).toMatchObject({
      type: "reserve-cash",
    });
    expect(result).toEqual(buildRunwayPlan(
      createProfile({
        cash_position: {
          available_cash: 28000,
          reserved_cash: 3000,
          severance_total: 15000,
          total_liquid_cash: 46000,
        },
        monthly_obligations: {
          essentials: 2600,
          discretionary: 250,
          debt_minimums: debts.reduce((sum, debt) => sum + debt.minimum_payment, 0),
          total_monthly_burn: 2600 + 250 + debts.reduce((sum, debt) => sum + debt.minimum_payment, 0),
        },
        debts,
      }),
    ));
  });

  it("breaks equal-burn safe payoff ties by lower projected interest carry", () => {
    const result = buildRunwayPlan(
      createProfile({
        cash_position: {
          available_cash: 15000,
          reserved_cash: 3000,
          severance_total: 7000,
          total_liquid_cash: 25000,
        },
        monthly_obligations: {
          essentials: 1800,
          discretionary: 200,
          debt_minimums: 200,
          total_monthly_burn: 2200,
        },
        debts: [
          {
            id: "small-high-apr",
            label: "Small High APR",
            balance: 1000,
            apr: 0.3,
            minimum_payment: 100,
          },
          {
            id: "large-lower-apr",
            label: "Large Lower APR",
            balance: 1600,
            apr: 0.19,
            minimum_payment: 100,
          },
        ],
      }),
    );

    expect(
      result.recommended_immediate_actions.filter((action) => action.type === "pay-extra-debt")[0],
    ).toMatchObject({
      amount: 1600,
    });
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
