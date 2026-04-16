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
  it("prompts for a missing numeric field and writes it back to the profile", async () => {
    const profilePath = writeProfile({
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
    });

    const prompts: string[] = [];
    const outcome = await runInteractiveAssist({
      profilePath,
      ask(question) {
        prompts.push(question);
        return Promise.resolve("0.2399");
      },
      isInteractive: true,
    });

    expect(prompts[0]).toContain('What APR should runway use for debt "Card A"?');
    expect(JSON.parse(readFileSync(profilePath, "utf8"))).toMatchObject({
      debts: [{ id: "card-a", apr: 0.2399 }],
    });
    expect(outcome.status).toBe("ready");
  });

  it("rejects blank numeric input without mutating the profile", async () => {
    const profilePath = writeProfile({
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
    });

    await expect(
      runInteractiveAssist({
        profilePath,
        ask() {
          return Promise.resolve("   ");
        },
        isInteractive: true,
      }),
    ).rejects.toThrow("Interactive assist needs a finite numeric APR answer.");

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
          minimum_payment: 220,
        },
      ],
      income_assumptions: {
        expected_monthly_income: 0,
        income_is_confirmed: false,
      },
    });
  });
});
