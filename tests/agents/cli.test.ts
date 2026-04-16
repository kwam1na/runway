import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

function writeJsonFile(filename: string, payload: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "runway-agent-cli-"));
  tempDirs.push(dir);
  const filePath = resolve(dir, filename);
  writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

function writeRawFile(filename: string, contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "runway-agent-cli-"));
  tempDirs.push(dir);
  const filePath = resolve(dir, filename);
  writeFileSync(filePath, contents, "utf8");
  return filePath;
}

describe("agent workflow cli", () => {
  it("returns targeted follow-up questions for an incomplete profile file", async () => {
    const profilePath = writeJsonFile("partial-profile.json", {
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

    const result = await runCli(["assist", profilePath]);

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      command: string;
      status: string;
      followUpQuestions: Array<{ path: string; question?: string }>;
    };

    expect(payload.command).toBe("assist");
    expect(payload.status).toBe("needs-input");
    expect(payload.followUpQuestions).toEqual([
      {
        path: "debts[0].apr",
        question: 'What APR should runway use for debt "Card A"?',
      },
      {
        path: "debts[0].minimum_payment",
        question: 'What is the minimum monthly payment for debt "Card A"?',
      },
    ]);
  });

  it("merges a local answer patch file before rerunning the workflow", async () => {
    const profilePath = writeJsonFile("partial-profile.json", {
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
    });
    const patchPath = writeJsonFile("answer-patch.json", {
      debts: [
        {
          id: "card-a",
          apr: 0.2399,
          minimum_payment: 220,
        },
      ],
    });

    const result = await runCli(["assist", profilePath, patchPath]);

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      status: string;
      result: {
        runway_estimate: {
          floor_status: string;
        };
      };
      report: string;
    };

    expect(payload.status).toBe("ready");
    expect(payload.result.runway_estimate.floor_status).toBe("meets-floor");
    expect(payload.report).toContain("# Runway Analysis");
  });

  it("returns a clear error for malformed answer patch files", async () => {
    const profilePath = writeJsonFile("partial-profile.json", {
      cash_position: {
        available_cash: 18000,
        reserved_cash: 2500,
        severance_total: 12000,
      },
      monthly_obligations: {
        essentials: 3200,
      },
      debts: [],
      income_assumptions: {},
    });
    const patchPath = writeRawFile("answer-patch.json", '{ "debts": [');

    const result = await runCli(["assist", profilePath, patchPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Answer patch file must contain valid JSON.");
  });
});
