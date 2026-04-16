import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runInteractiveAssist } from "../../src/runway/interactive-assist.js";
import { runCli } from "../../src/runway/cli.js";

vi.mock("../../src/runway/interactive-assist.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/runway/interactive-assist.js")>();

  return {
    ...actual,
    runInteractiveAssist: vi.fn(),
  };
});

const tempDirs: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }

  vi.clearAllMocks();
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

function restoreTtyState(
  stdinDescriptor: PropertyDescriptor | undefined,
  stdoutDescriptor: PropertyDescriptor | undefined,
): void {
  if (stdinDescriptor) {
    Object.defineProperty(process.stdin, "isTTY", stdinDescriptor);
  }

  if (stdoutDescriptor) {
    Object.defineProperty(process.stdout, "isTTY", stdoutDescriptor);
  }
}

describe("agent workflow cli", () => {
  it("creates a default profile path for interactive assist when none is provided", async () => {
    const dir = mkdtempSync(join(tmpdir(), "runway-agent-cli-cwd-"));
    tempDirs.push(dir);
    process.chdir(dir);

    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

    vi.mocked(runInteractiveAssist).mockResolvedValue({
      status: "ready",
      profile: {},
      analysis: {
        ok: true,
        profile: {} as never,
        result: {
          snapshot: {
            liquid_cash: 1,
            monthly_burn: 1,
            runway_months: 1,
          },
          recommended_immediate_actions: [],
          monthly_plan: [],
          runway_estimate: {
            months: 1,
            floor_months: 6,
            floor_status: "meets-floor",
          },
          assumptions: [],
          risk_flags: [],
        },
        report: "# Runway Analysis",
      },
      result: {
        snapshot: {
          liquid_cash: 1,
          monthly_burn: 1,
          runway_months: 1,
        },
        recommended_immediate_actions: [],
        monthly_plan: [],
        runway_estimate: {
          months: 1,
          floor_months: 6,
          floor_status: "meets-floor",
        },
        assumptions: [],
        risk_flags: [],
      },
      report: "# Runway Analysis",
    });

    try {
      const result = await runCli(["assist"]);
      const payload = JSON.parse(result.stdout) as {
        command: string;
        status: string;
        profilePath: string;
      };

      expect(result.exitCode).toBe(0);
      expect(payload).toMatchObject({
        command: "assist",
        status: "ready",
      });
      expect(payload.profilePath).toMatch(/runway-profile\.json$/);
      expect(runInteractiveAssist).toHaveBeenCalledWith({
        profilePath: payload.profilePath,
        ask: expect.any(Function),
        isInteractive: true,
      });
    } finally {
      restoreTtyState(stdinDescriptor, stdoutDescriptor);
    }
  });

  it("delegates to interactive assist in a tty session without a patch file", async () => {
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
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

    vi.mocked(runInteractiveAssist).mockResolvedValue({
      status: "ready",
      profile: {
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
      },
      analysis: {
        ok: true,
        profile: {} as never,
        result: {
          snapshot: {
            liquid_cash: 1,
            monthly_burn: 1,
            runway_months: 1,
          },
          recommended_immediate_actions: [],
          monthly_plan: [],
          runway_estimate: {
            months: 1,
            floor_months: 6,
            floor_status: "meets-floor",
          },
          assumptions: [],
          risk_flags: [],
        },
        report: "# Runway Analysis",
      },
      result: {
        snapshot: {
          liquid_cash: 1,
          monthly_burn: 1,
          runway_months: 1,
        },
        recommended_immediate_actions: [],
        monthly_plan: [],
        runway_estimate: {
          months: 1,
          floor_months: 6,
          floor_status: "meets-floor",
        },
        assumptions: [],
        risk_flags: [],
      },
      report: "# Runway Analysis",
    });

    try {
      const result = await runCli(["assist", profilePath]);

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: "assist",
        status: "ready",
      });
      expect(runInteractiveAssist).toHaveBeenCalledWith({
        profilePath,
        ask: expect.any(Function),
        isInteractive: true,
      });
    } finally {
      restoreTtyState(stdinDescriptor, stdoutDescriptor);
    }
  });

  it("returns targeted follow-up questions for an incomplete profile file when not in a tty", async () => {
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
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });

    try {
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
      expect(runInteractiveAssist).not.toHaveBeenCalled();
    } finally {
      restoreTtyState(stdinDescriptor, stdoutDescriptor);
    }
  });

  it("requires either a profile path or an interactive tty session", async () => {
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });

    try {
      const result = await runCli(["assist"]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe(
        "Usage: assist [profile-path] [answer-patch-path]\nOmit profile-path only in an interactive TTY session.",
      );
      expect(runInteractiveAssist).not.toHaveBeenCalled();
    } finally {
      restoreTtyState(stdinDescriptor, stdoutDescriptor);
    }
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
    expect(runInteractiveAssist).not.toHaveBeenCalled();
  });

  it("keeps patch-file assist non-interactive even in a tty session", async () => {
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
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });

    try {
      const result = await runCli(["assist", profilePath, patchPath]);

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: "assist",
        status: "ready",
      });
      expect(runInteractiveAssist).not.toHaveBeenCalled();
    } finally {
      restoreTtyState(stdinDescriptor, stdoutDescriptor);
    }
  });

  it("returns a clear error for malformed profile files", async () => {
    const profilePath = writeRawFile("partial-profile.json", '{ "cash_position": ');
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });

    try {
      const result = await runCli(["assist", profilePath]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("Profile file must contain valid JSON.");
    } finally {
      restoreTtyState(stdinDescriptor, stdoutDescriptor);
    }
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
