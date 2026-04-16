import { describe, expect, it } from "vitest";
import {
  createEmptyPlannerResult,
  normalizeFinancialProfile,
  normalizePlannerResult,
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

  it("rejects duplicate debt identifiers so downstream payment plans stay referentially sound", () => {
    const result = normalizeFinancialProfile({
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
          apr: 0.2399,
          minimum_payment: 220,
        },
        {
          id: "card-a",
          label: "Card B",
          balance: 1800,
          apr: 0.1299,
          minimum_payment: 90,
        },
      ],
      income_assumptions: {},
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected normalization failure");
    }

    expect(result.errors).toContainEqual({
      path: "debts[1].id",
      message: "Debt identifiers must be unique across the profile.",
    });
  });

  it("rejects non-finite numeric values before they can poison planner math", () => {
    const result = normalizeFinancialProfile({
      cash_position: {
        available_cash: Number.NaN,
        reserved_cash: 0,
        severance_total: 0,
      },
      monthly_obligations: {
        essentials: 1000,
      },
      debts: [
        {
          id: "card-a",
          label: "Card A",
          balance: 1000,
          apr: Number.POSITIVE_INFINITY,
          minimum_payment: 50,
        },
      ],
      income_assumptions: {},
      planning_preferences: {
        runway_floor_months: Number.POSITIVE_INFINITY,
      },
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected normalization failure");
    }

    expect(result.errors).toEqual([
      {
        path: "cash_position.available_cash",
        message: "Available cash must be a finite number.",
      },
      {
        path: "debts[0].apr",
        message: "Debt APR must be a finite number.",
      },
      {
        path: "planning_preferences.runway_floor_months",
        message: "Runway floor months must be a finite number.",
      },
    ]);
  });

  it("returns validation errors instead of throwing when profile collections are malformed", () => {
    const result = normalizeFinancialProfile({
      cash_position: {
        available_cash: 18000,
        reserved_cash: 2500,
        severance_total: 12000,
      },
      monthly_obligations: {
        essentials: 3200,
      },
      debts: { id: "card-a" } as unknown as never[],
      income_assumptions: {
        notes: "keep runway high" as unknown as never[],
      },
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected malformed collection validation failure");
    }

    expect(result.errors).toEqual([
      {
        path: "debts",
        message: "Debts must be provided as an array.",
      },
      {
        path: "income_assumptions.notes",
        message: "Income assumption notes must be provided as an array of strings.",
      },
    ]);
  });

  it("rejects malformed nested profile sections instead of silently defaulting them", () => {
    const result = normalizeFinancialProfile({
      cash_position: {
        available_cash: 18000,
        reserved_cash: 2500,
        severance_total: 12000,
      },
      monthly_obligations: {
        essentials: 3200,
      },
      debts: [],
      income_assumptions: "oops" as unknown as never,
      planning_preferences: "oops" as unknown as never,
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected malformed nested profile section failure");
    }

    expect(result.errors).toEqual([
      {
        path: "income_assumptions",
        message: "Income assumptions must be an object when provided.",
      },
      {
        path: "planning_preferences",
        message: "Planning preferences must be an object when provided.",
      },
    ]);
  });

  it("validates boolean and policy fields at runtime instead of trusting static typing", () => {
    const result = normalizeFinancialProfile({
      cash_position: {
        available_cash: 18000,
        reserved_cash: 2500,
        severance_total: 12000,
      },
      monthly_obligations: {
        essentials: 3200,
      },
      debts: [],
      income_assumptions: {
        expected_monthly_income: 0,
        income_is_confirmed: "false" as unknown as boolean,
      },
      planning_preferences: {
        strategy: "interest-first" as unknown as "runway-first",
        prioritize_interest_savings: "yes" as unknown as boolean,
      },
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected boolean validation failure");
    }

    expect(result.errors).toEqual([
      {
        path: "income_assumptions.income_is_confirmed",
        message: "Income confirmation must be a boolean.",
      },
      {
        path: "planning_preferences.prioritize_interest_savings",
        message: "Interest-savings preference must be a boolean.",
      },
      {
        path: "planning_preferences.strategy",
        message: "Planning strategy must be runway-first in v1.",
      },
    ]);
  });

  it("asks for confirmation before counting positive future income in the normalized profile", () => {
    const result = normalizeFinancialProfile({
      cash_position: {
        available_cash: 18000,
        reserved_cash: 2500,
        severance_total: 12000,
      },
      monthly_obligations: {
        essentials: 3200,
      },
      debts: [],
      income_assumptions: {
        expected_monthly_income: 3000,
      },
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected ambiguous income validation failure");
    }

    expect(result.errors).toEqual([
      {
        path: "income_assumptions.income_is_confirmed",
        message: "Expected monthly income must be confirmed before runway can count it.",
        question:
          "Is the expected monthly income confirmed enough to include in runway planning?",
      },
    ]);
  });

  it("returns a root-level validation error for malformed profile payloads", () => {
    const result = normalizeFinancialProfile(null as unknown as never);

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected malformed profile root validation failure");
    }

    expect(result.errors).toEqual([
      {
        path: "$",
        message: "Financial profile payload must be an object.",
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

  it("validates and normalizes planner results before downstream consumers trust them", () => {
    const result = normalizePlannerResult({
      snapshot: {
        liquid_cash: 32500,
        monthly_burn: 3870,
        runway_months: 8.4,
      },
      recommended_immediate_actions: [
        {
          type: "pay-minimums",
          summary: "Pay all required minimums before considering extra debt reduction.",
          amount: 220,
        },
      ],
      monthly_plan: [
        {
          month: 1,
          starting_cash: 32500,
          ending_cash: 28630,
          debt_payments: [
            {
              debt_id: "card-a",
              amount: 220,
            },
          ],
        },
      ],
      runway_estimate: {
        months: 8.4,
        floor_status: "meets-floor",
      },
      assumptions: ["No future income is assumed until it is confirmed."],
      risk_flags: [
        {
          severity: "warning",
          summary: "Runway falls materially if discretionary spending increases.",
        },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("expected planner result normalization success");
    }

    expect(result.result).toEqual({
      snapshot: {
        liquid_cash: 32500,
        monthly_burn: 3870,
        runway_months: 8.4,
      },
      recommended_immediate_actions: [
        {
          type: "pay-minimums",
          summary: "Pay all required minimums before considering extra debt reduction.",
          amount: 220,
        },
      ],
      monthly_plan: [
        {
          month: 1,
          starting_cash: 32500,
          ending_cash: 28630,
          debt_payments: [
            {
              debt_id: "card-a",
              amount: 220,
            },
          ],
        },
      ],
      runway_estimate: {
        months: 8.4,
        floor_months: 6,
        floor_status: "meets-floor",
      },
      assumptions: ["No future income is assumed until it is confirmed."],
      risk_flags: [
        {
          severity: "warning",
          summary: "Runway falls materially if discretionary spending increases.",
        },
      ],
    });
  });

  it("returns targeted planner-result validation errors for malformed runtime payloads", () => {
    const result = normalizePlannerResult({
      snapshot: {
        liquid_cash: Number.POSITIVE_INFINITY,
        monthly_burn: 3870,
        runway_months: -1,
      },
      recommended_immediate_actions: [
        {
          type: "pay-minimums",
          summary: "",
        },
      ],
      monthly_plan: [
        {
          month: 1,
          starting_cash: 32500,
          ending_cash: 28630,
          debt_payments: [
            {
              debt_id: "",
              amount: 220,
            },
          ],
        },
      ],
      runway_estimate: {
        months: 8.4,
        floor_months: Number.POSITIVE_INFINITY,
        floor_status: "unknown",
      },
      assumptions: [],
      risk_flags: [],
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected planner result normalization failure");
    }

    expect(result.errors).toEqual([
      {
        path: "snapshot.liquid_cash",
        message: "Snapshot liquid cash must be a finite number.",
      },
      {
        path: "snapshot.runway_months",
        message: "Snapshot runway months cannot be negative.",
      },
      {
        path: "runway_estimate.floor_months",
        message: "Runway floor months must be a finite number.",
      },
      {
        path: "recommended_immediate_actions[0].summary",
        message: "Planner actions must include a short summary.",
      },
      {
        path: "monthly_plan[0].debt_payments[0].debt_id",
        message: "Monthly debt payments must reference a debt identifier.",
      },
    ]);
  });

  it("rejects planner results whose floor status contradicts the numeric runway estimate", () => {
    const result = normalizePlannerResult({
      snapshot: {
        liquid_cash: 32500,
        monthly_burn: 3870,
        runway_months: 2,
      },
      recommended_immediate_actions: [],
      monthly_plan: [],
      runway_estimate: {
        months: 2,
        floor_months: 6,
        floor_status: "meets-floor",
      },
      assumptions: [],
      risk_flags: [],
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected contradictory floor status validation failure");
    }

    expect(result.errors).toEqual([
      {
        path: "runway_estimate.floor_status",
        message: "Runway floor status must match whether estimated months clear the configured floor.",
      },
    ]);
  });

  it("returns planner-result validation errors instead of throwing on malformed collections", () => {
    const result = normalizePlannerResult({
      snapshot: {
        liquid_cash: 32500,
        monthly_burn: 3870,
        runway_months: 8.4,
      },
      recommended_immediate_actions: { type: "pay-minimums" } as unknown as never[],
      monthly_plan: [
        {
          month: 1,
          starting_cash: 32500,
          ending_cash: 28630,
          debt_payments: { debt_id: "card-a", amount: 220 } as unknown as never[],
        },
      ],
      runway_estimate: {
        months: 8.4,
      },
      assumptions: "no future income" as unknown as never[],
      risk_flags: { severity: "warning", summary: "watch burn" } as unknown as never[],
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected malformed planner collection validation failure");
    }

    expect(result.errors).toEqual([
      {
        path: "recommended_immediate_actions",
        message: "Recommended actions must be provided as an array.",
      },
      {
        path: "assumptions",
        message: "Assumptions must be provided as an array of strings.",
      },
      {
        path: "risk_flags",
        message: "Risk flags must be provided as an array.",
      },
      {
        path: "monthly_plan[0].debt_payments",
        message: "Monthly debt payments must be provided as an array.",
      },
    ]);
  });

  it("rejects malformed nested planner-result sections instead of silently treating them as empty", () => {
    const result = normalizePlannerResult({
      snapshot: "oops" as unknown as never,
      recommended_immediate_actions: [],
      monthly_plan: [],
      runway_estimate: "oops" as unknown as never,
      assumptions: [],
      risk_flags: [],
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected malformed nested planner section failure");
    }

    expect(result.errors).toEqual([
      {
        path: "snapshot",
        message: "Planner snapshot must be an object when provided.",
      },
      {
        path: "runway_estimate",
        message: "Runway estimate must be an object when provided.",
      },
      {
        path: "snapshot.liquid_cash",
        message: "Snapshot liquid cash is required.",
      },
      {
        path: "snapshot.monthly_burn",
        message: "Snapshot monthly burn is required.",
      },
      {
        path: "snapshot.runway_months",
        message: "Snapshot runway months is required.",
      },
      {
        path: "runway_estimate.months",
        message: "Runway estimate months is required.",
      },
    ]);
  });

  it("returns a root-level validation error for malformed planner-result payloads", () => {
    const result = normalizePlannerResult(null as unknown as never);

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected malformed planner-result root validation failure");
    }

    expect(result.errors).toEqual([
      {
        path: "$",
        message: "Planner result payload must be an object.",
      },
    ]);
  });
});
