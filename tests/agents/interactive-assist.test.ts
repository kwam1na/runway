import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runInteractiveAssist } from "../../src/runway/interactive-assist.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeProfile(payload: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "runway-interactive-"));
  tempDirs.push(dir);
  const profilePath = resolve(dir, "profile.json");
  writeFileSync(profilePath, JSON.stringify(payload, null, 2), "utf8");
  return profilePath;
}

describe("interactive assist", () => {
  it("continues through apr and minimum payment until the profile is ready", async () => {
    const originalProfile = {
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
      },
    };
    const profilePath = writeProfile(originalProfile);
    const backupPath = `${profilePath}.bak`;

    const prompts: string[] = [];
    let attempts = 0;
    const outcome = await runInteractiveAssist({
      profilePath,
      ask(question) {
        prompts.push(question);
        attempts += 1;

        if (attempts === 1) {
          expect(JSON.parse(readFileSync(profilePath, "utf8"))).toEqual({
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
            },
          });
          return Promise.resolve("   ");
        }

        if (attempts === 2) {
          expect(JSON.parse(readFileSync(profilePath, "utf8"))).toEqual({
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
            },
          });
          return Promise.resolve("0.2399");
        }

        expect(JSON.parse(readFileSync(profilePath, "utf8"))).toMatchObject({
          debts: [
            {
              id: "card-a",
              apr: 0.2399,
            },
          ],
        });
        return Promise.resolve("220");
      },
      isInteractive: true,
    });

    expect(prompts).toEqual([
      'What APR should runway use for debt "Card A"?',
      'What APR should runway use for debt "Card A"?',
      'What is the minimum monthly payment for debt "Card A"?',
    ]);
    expect(JSON.parse(readFileSync(profilePath, "utf8"))).toMatchObject({
      debts: [{ id: "card-a", apr: 0.2399, minimum_payment: 220 }],
    });
    expect(JSON.parse(readFileSync(backupPath, "utf8"))).toEqual(originalProfile);
    expect(outcome.status).toBe("ready");
  });

  it("reprompts on blank numeric input without mutating the profile", async () => {
    const originalProfile = {
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
          minimum_payment: 220,
        },
      ],
      income_assumptions: {
        expected_monthly_income: 0,
        income_is_confirmed: false,
      },
    };
    const profilePath = writeProfile(originalProfile);
    const prompts: string[] = [];
    let attempts = 0;

    const outcome = await runInteractiveAssist({
      profilePath,
      async ask(question) {
        prompts.push(question);
        attempts += 1;

        expect(JSON.parse(readFileSync(profilePath, "utf8"))).toEqual(originalProfile);

        return attempts === 1 ? "   " : "0.2399";
      },
      isInteractive: true,
    });

    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain('What APR should runway use for debt "Card A"?');
    expect(JSON.parse(readFileSync(profilePath, "utf8"))).toMatchObject({
      debts: [{ id: "card-a", apr: 0.2399 }],
    });
    expect(outcome.status).toBe("ready");
  });

  it("writes a confirmed-income boolean answer and creates a backup", async () => {
    const originalProfile = {
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
        expected_monthly_income: 500,
      },
    };
    const profilePath = writeProfile(originalProfile);
    const backupPath = `${profilePath}.bak`;
    const prompts: string[] = [];
    let attempts = 0;

    const outcome = await runInteractiveAssist({
      profilePath,
      ask(question) {
        prompts.push(question);
        attempts += 1;

        expect(JSON.parse(readFileSync(profilePath, "utf8"))).toEqual(originalProfile);

        return Promise.resolve(attempts === 1 ? "maybe" : "yes");
      },
      isInteractive: true,
    });

    expect(prompts).toEqual([
      "Is the expected monthly income confirmed enough to include in runway planning?",
      "Is the expected monthly income confirmed enough to include in runway planning?",
    ]);
    expect(JSON.parse(readFileSync(profilePath, "utf8"))).toMatchObject({
      income_assumptions: {
        expected_monthly_income: 500,
        income_is_confirmed: true,
      },
    });
    expect(JSON.parse(readFileSync(backupPath, "utf8"))).toEqual(originalProfile);
    expect(outcome.status).toBe("ready");
  });

  it("bootstraps a new profile file from interactive intake when the file does not exist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "runway-interactive-bootstrap-"));
    tempDirs.push(dir);
    const profilePath = resolve(dir, "runway-profile.json");
    const prompts: string[] = [];
    const answers = ["18000", "2500", "12000", "3200", "450", "0", "0"];

    const outcome = await runInteractiveAssist({
      profilePath,
      ask(question) {
        prompts.push(question);
        const answer = answers.shift();

        if (!answer) {
          throw new Error(`Unexpected question: ${question}`);
        }

        return Promise.resolve(answer);
      },
      isInteractive: true,
    });

    expect(prompts).toEqual([
      "How much available cash can runway use right now?",
      "How much cash should stay reserved?",
      "How much severance cash is available?",
      "What are the essential monthly obligations?",
      "What are the discretionary monthly obligations? Enter 0 if none.",
      "How many debts should runway track?",
      "What expected monthly income should runway include before confirmation? Enter 0 if none.",
    ]);
    expect(JSON.parse(readFileSync(profilePath, "utf8"))).toEqual({
      cash_position: {
        available_cash: 18000,
        reserved_cash: 2500,
        severance_total: 12000,
      },
      monthly_obligations: {
        essentials: 3200,
        discretionary: 450,
      },
      debts: [],
      income_assumptions: {
        expected_monthly_income: 0,
        income_is_confirmed: false,
      },
      planning_preferences: {
        strategy: "runway-first",
        runway_floor_months: 6,
        prioritize_interest_savings: false,
      },
    });
    expect(outcome.status).toBe("ready");
  });
});
