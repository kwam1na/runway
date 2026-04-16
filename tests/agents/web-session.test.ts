import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBrowserSession } from "../../src/runway/web/session.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempProfile(payload: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "runway-web-session-"));
  tempDirs.push(dir);
  const profilePath = resolve(dir, "profile.json");
  writeFileSync(profilePath, JSON.stringify(payload, null, 2), "utf8");
  return profilePath;
}

describe("browser session", () => {
  it("maps an incomplete profile into browser step state", async () => {
    const profilePath = createTempProfile({
      debts: [],
    });

    const session = await createBrowserSession({ profilePath });
    const state = session.getState();

    expect(state.steps.find((step) => step.id === "cash")?.status).toBe("current");
    expect(state.steps.find((step) => step.id === "obligations")?.status).toBe("upcoming");
    expect(state.steps.find((step) => step.id === "plan")?.status).toBe("locked");
    expect(state.profilePath).toBe(profilePath);
  });

  it("persists profile updates and creates a one-time backup of the original profile", async () => {
    const profilePath = createTempProfile({
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
      },
    });

    const session = await createBrowserSession({ profilePath });
    await session.saveProfile({
      ...session.getState().profile,
      income_assumptions: {
        expected_monthly_income: 0,
        income_is_confirmed: false,
      },
    });

    expect(existsSync(`${profilePath}.bak`)).toBe(true);
    expect(JSON.parse(readFileSync(`${profilePath}.bak`, "utf8"))).toEqual({
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
      },
    });
    expect(JSON.parse(readFileSync(profilePath, "utf8"))).toMatchObject({
      income_assumptions: {
        expected_monthly_income: 0,
        income_is_confirmed: false,
      },
    });
  });

  it("merges reviewed statement candidates into the saved profile", async () => {
    const profilePath = createTempProfile({
      debts: [],
    });

    const session = await createBrowserSession({ profilePath });
    await session.mergeStatementCandidates([
      {
        label: "Card A",
        balance: 6400,
        minimum_payment: 220,
        apr_candidates: [],
        selected_apr: 0.2399,
      },
    ]);

    expect(session.getState().profile.debts).toMatchObject([
      {
        label: "Card A",
        balance: 6400,
        apr: 0.2399,
        minimum_payment: 220,
      },
    ]);
    expect(JSON.parse(readFileSync(profilePath, "utf8"))).toMatchObject({
      debts: [
        {
          label: "Card A",
          balance: 6400,
          apr: 0.2399,
          minimum_payment: 220,
        },
      ],
    });
  });
});
