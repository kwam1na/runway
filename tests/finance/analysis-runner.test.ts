import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/runway/cli.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeProfileFile(filename: string, payload: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "runway-analysis-"));
  tempDirs.push(dir);
  const profilePath = resolve(dir, filename);
  writeFileSync(profilePath, JSON.stringify(payload, null, 2), "utf8");
  return profilePath;
}

describe("local analysis runner", () => {
  it("analyzes a valid profile through the CLI and emits both result data and a markdown report", async () => {
    const profilePath = writeProfileFile("valid-profile.json", {
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
    });

    const result = await runCli(["analyze", profilePath]);

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      command: string;
      profilePath: string;
      result: {
        runway_estimate: {
          floor_status: string;
        };
      };
      report: string;
    };

    expect(payload.command).toBe("analyze");
    expect(payload.profilePath).toBe(profilePath);
    expect(payload.result.runway_estimate.floor_status).toBe("meets-floor");
    expect(payload.report).toContain("# Runway Analysis");
    expect(payload.report).toContain("## Snapshot");
    expect(payload.report).toContain("## Recommended actions now");
    expect(payload.report).toContain("## Monthly plan");
    expect(payload.report).toContain("## Risks and assumptions");
  });

  it("returns targeted validation feedback for invalid profiles instead of partial recommendations", async () => {
    const profilePath = writeProfileFile("invalid-profile.json", {
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
        },
      ],
    });

    const result = await runCli(["analyze", profilePath]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("debts[0].minimum_payment");
    expect(result.stderr).not.toContain("## Snapshot");
  });

  it("produces materially identical output for repeated analysis of the same unchanged profile", async () => {
    const profilePath = writeProfileFile("stable-profile.json", {
      cash_position: {
        available_cash: 15000,
        reserved_cash: 3000,
        severance_total: 9000,
      },
      monthly_obligations: {
        essentials: 2800,
        discretionary: 300,
      },
      debts: [
        {
          id: "card-a",
          label: "Card A",
          balance: 5200,
          apr: 0.219,
          minimum_payment: 180,
        },
      ],
      income_assumptions: {
        expected_monthly_income: 0,
        income_is_confirmed: false,
      },
    });

    const first = await runCli(["analyze", profilePath]);
    const second = await runCli(["analyze", profilePath]);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(JSON.parse(first.stdout)).toEqual(JSON.parse(second.stdout));
    expect(readFileSync(profilePath, "utf8")).toContain("\"cash_position\"");
  });
});
