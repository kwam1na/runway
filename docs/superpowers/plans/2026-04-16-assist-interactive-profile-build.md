# Assist Interactive Profile Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `runway assist` so the CLI can build an incomplete local profile interactively, writing accepted answers directly back into the profile file until the shared agent workflow reaches `ready`.

**Architecture:** Keep `src/runway/agents/` as the source of truth for validator-driven workflow state and add a focused interactive CLI layer that prompts for the next missing value, persists it to disk, and reruns the workflow. Preserve the current non-interactive file-based `assist` path for deterministic automation, fixtures, and tests.

**Tech Stack:** TypeScript, Node.js, Vitest, `tsx`, existing `runAgentWorkflow` agent layer, existing runway CLI and harness tooling

---

### Task 1: Add an interactive assist session helper with direct file persistence

**Files:**
- Create: `src/runway/interactive-assist.ts`
- Test: `tests/agents/interactive-assist.test.ts`

- [ ] **Step 1: Write the failing test for numeric follow-up prompting**

```ts
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/agents/interactive-assist.test.ts
```

Expected: FAIL because `src/runway/interactive-assist.ts` does not exist yet.

- [ ] **Step 3: Write the minimal interactive session helper**

```ts
import { readFile, writeFile } from "node:fs/promises";
import { runAgentWorkflow, type AgentWorkflowOutcome } from "./agents/index.js";
import type { LocalFinancialProfileInput } from "./finance/index.js";

export type InteractiveAssistOptions = {
  profilePath: string;
  ask(question: string): Promise<string>;
  isInteractive: boolean;
};

async function readProfile(profilePath: string): Promise<LocalFinancialProfileInput> {
  return JSON.parse(await readFile(profilePath, "utf8")) as LocalFinancialProfileInput;
}

async function writeProfile(profilePath: string, profile: LocalFinancialProfileInput): Promise<void> {
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

function setDebtField(
  profile: LocalFinancialProfileInput,
  debtIndex: number,
  field: "apr" | "minimum_payment",
  value: number,
): LocalFinancialProfileInput {
  const debts = profile.debts?.map((debt) => ({ ...debt })) ?? [];
  debts[debtIndex] = {
    ...debts[debtIndex],
    [field]: value,
  };
  return {
    ...profile,
    debts,
  };
}

function applyAnswer(
  profile: LocalFinancialProfileInput,
  path: string,
  answer: string,
): LocalFinancialProfileInput {
  if (path === "debts[0].apr") {
    const value = Number(answer);
    if (!Number.isFinite(value)) {
      throw new Error("Debt APR answer must be a finite number.");
    }
    return setDebtField(profile, 0, "apr", value);
  }

  throw new Error(`Interactive assist cannot handle path: ${path}`);
}

export async function runInteractiveAssist(
  options: InteractiveAssistOptions,
): Promise<AgentWorkflowOutcome> {
  let profile = await readProfile(options.profilePath);
  let outcome = runAgentWorkflow(profile);

  while (options.isInteractive && outcome.status === "needs-input" && outcome.followUpQuestions.length > 0) {
    const nextQuestion = outcome.followUpQuestions[0];
    if (!nextQuestion.question) {
      return outcome;
    }

    const answer = await options.ask(nextQuestion.question);
    profile = applyAnswer(profile, nextQuestion.path, answer);
    await writeProfile(options.profilePath, profile);
    outcome = runAgentWorkflow(profile);
  }

  return outcome;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm run test -- tests/agents/interactive-assist.test.ts
```

Expected: PASS for the numeric follow-up test.

- [ ] **Step 5: Commit**

```bash
git add src/runway/interactive-assist.ts tests/agents/interactive-assist.test.ts
git commit -m "feat: add interactive assist session helper"
```

### Task 2: Handle booleans, reprompts, and one-time backup creation

**Files:**
- Modify: `src/runway/interactive-assist.ts`
- Modify: `tests/agents/interactive-assist.test.ts`

- [ ] **Step 1: Write the failing boolean and reprompt tests**

```ts
it("reprompts on invalid numeric input without mutating the file", async () => {
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

  const answers = ["not-a-number", "0.2399"];
  let callCount = 0;

  const outcome = await runInteractiveAssist({
    profilePath,
    ask() {
      const answer = answers[callCount]!;
      callCount += 1;
      return Promise.resolve(answer);
    },
    isInteractive: true,
  });

  expect(callCount).toBe(2);
  expect(JSON.parse(readFileSync(profilePath, "utf8"))).toMatchObject({
    debts: [{ id: "card-a", apr: 0.2399 }],
  });
  expect(outcome.status).toBe("ready");
});

it("accepts boolean answers and creates a backup before the first write", async () => {
  const profilePath = writeProfile({
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

  const outcome = await runInteractiveAssist({
    profilePath,
    ask() {
      return Promise.resolve("yes");
    },
    isInteractive: true,
  });

  expect(JSON.parse(readFileSync(profilePath, "utf8"))).toMatchObject({
    income_assumptions: {
      expected_monthly_income: 3000,
      income_is_confirmed: true,
    },
  });
  expect(readFileSync(`${profilePath}.bak`, "utf8")).toContain("\"expected_monthly_income\": 3000");
  expect(outcome.status).toBe("ready");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- tests/agents/interactive-assist.test.ts
```

Expected: FAIL because invalid input currently throws and boolean follow-ups are not handled yet.

- [ ] **Step 3: Extend the helper for reprompts, booleans, and backup creation**

```ts
import { access, copyFile, readFile, writeFile } from "node:fs/promises";

async function ensureBackup(profilePath: string): Promise<void> {
  const backupPath = `${profilePath}.bak`;
  try {
    await access(backupPath);
  } catch {
    await copyFile(profilePath, backupPath);
  }
}

function parseBoolean(answer: string): boolean | undefined {
  const normalized = answer.trim().toLowerCase();
  if (["y", "yes", "true"].includes(normalized)) return true;
  if (["n", "no", "false"].includes(normalized)) return false;
  return undefined;
}

function setIncomeConfirmed(
  profile: LocalFinancialProfileInput,
  value: boolean,
): LocalFinancialProfileInput {
  return {
    ...profile,
    income_assumptions: {
      ...profile.income_assumptions,
      income_is_confirmed: value,
    },
  };
}

function applyAnswer(
  profile: LocalFinancialProfileInput,
  path: string,
  answer: string,
): LocalFinancialProfileInput | undefined {
  if (path === "debts[0].apr") {
    const value = Number(answer);
    return Number.isFinite(value) ? setDebtField(profile, 0, "apr", value) : undefined;
  }

  if (path === "income_assumptions.income_is_confirmed") {
    const parsed = parseBoolean(answer);
    return parsed === undefined ? undefined : setIncomeConfirmed(profile, parsed);
  }

  throw new Error(`Interactive assist cannot handle path: ${path}`);
}

// inside the loop
await ensureBackup(options.profilePath);

for (;;) {
  const answer = await options.ask(nextQuestion.question);
  const updatedProfile = applyAnswer(profile, nextQuestion.path, answer);
  if (!updatedProfile) {
    continue;
  }
  profile = updatedProfile;
  await writeProfile(options.profilePath, profile);
  break;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npm run test -- tests/agents/interactive-assist.test.ts
```

Expected: PASS for numeric prompting, reprompt handling, boolean handling, and backup creation.

- [ ] **Step 5: Commit**

```bash
git add src/runway/interactive-assist.ts tests/agents/interactive-assist.test.ts
git commit -m "feat: support interactive assist answers"
```

### Task 3: Wire interactive mode through `assist` while preserving non-interactive behavior

**Files:**
- Modify: `src/runway/cli.ts`
- Modify: `tests/agents/cli.test.ts`

- [ ] **Step 1: Write the failing CLI tests for interactive delegation and fallback behavior**

```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/runway/interactive-assist.js", () => ({
  runInteractiveAssist: vi.fn(),
}));

it("uses interactive assist when running in a TTY without a patch file", async () => {
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

  const originalIsTTY = process.stdin.isTTY;
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

  const { runInteractiveAssist } = await import("../../src/runway/interactive-assist.js");
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
        snapshot: { liquid_cash: 1, monthly_burn: 1, runway_months: 1 },
        recommended_immediate_actions: [],
        monthly_plan: [],
        runway_estimate: { months: 1, floor_months: 6, floor_status: "meets-floor" },
        assumptions: [],
        risk_flags: [],
      },
      report: "# Runway Analysis",
    },
    result: {
      snapshot: { liquid_cash: 1, monthly_burn: 1, runway_months: 1 },
      recommended_immediate_actions: [],
      monthly_plan: [],
      runway_estimate: { months: 1, floor_months: 6, floor_status: "meets-floor" },
      assumptions: [],
      risk_flags: [],
    },
    report: "# Runway Analysis",
  });

  const result = await runCli(["assist", profilePath]);

  expect(result.exitCode).toBe(0);
  expect(runInteractiveAssist).toHaveBeenCalled();

  Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
});

it("keeps the current non-interactive JSON response when stdin is not a TTY", async () => {
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

  const originalIsTTY = process.stdin.isTTY;
  Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });

  const result = await runCli(["assist", profilePath]);

  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout).status).toBe("needs-input");

  Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
});
```

- [ ] **Step 2: Run the CLI tests to verify they fail**

Run:

```bash
npm run test -- tests/agents/cli.test.ts
```

Expected: FAIL because `assist` does not branch into an interactive session yet.

- [ ] **Step 3: Wire `assist` into the interactive helper**

```ts
import { runInteractiveAssist } from "./interactive-assist.js";

function isInteractiveAssistSession(patchPath: string | undefined): boolean {
  return !patchPath && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}

// inside the assist command
if (isInteractiveAssistSession(patchPath)) {
  const outcome = await runInteractiveAssist({
    profilePath,
    ask(question) {
      return new Promise((resolve) => {
        process.stdout.write(`${question}\n> `);
        process.stdin.once("data", (chunk) => resolve(String(chunk).trim()));
      });
    },
    isInteractive: true,
  });

  return outcome.status === "needs-input"
    ? jsonResult(command, {
        status: outcome.status,
        profilePath,
        profile: outcome.profile,
        validationIssues: outcome.validationIssues,
        followUpQuestions: outcome.followUpQuestions,
      })
    : jsonResult(command, {
        status: outcome.status,
        profilePath,
        profile: outcome.profile,
        result: outcome.result,
        report: outcome.report,
      });
}
```

- [ ] **Step 4: Run the CLI tests to verify they pass**

Run:

```bash
npm run test -- tests/agents/cli.test.ts
```

Expected: PASS for both interactive delegation and non-interactive fallback behavior.

- [ ] **Step 5: Commit**

```bash
git add src/runway/cli.ts tests/agents/cli.test.ts
git commit -m "feat: wire interactive assist through cli"
```

### Task 4: Update docs and harness coverage for interactive assist

**Files:**
- Modify: `docs/agent/index.md`
- Modify: `docs/agent/analysis-workflow.md`
- Modify: `tests/harness/docs-presence.test.ts`
- Modify: `tests/harness/cli.test.ts`

- [ ] **Step 1: Write the failing docs expectations**

```ts
expect(index).toContain("interactive TTY");
expect(analysisWorkflow).toContain("writes the accepted answer directly back into the profile file");
expect(analysisWorkflow).toContain("creates a one-time backup");
```

- [ ] **Step 2: Run the harness docs tests to verify they fail**

Run:

```bash
npm run test -- tests/harness/docs-presence.test.ts tests/harness/cli.test.ts
```

Expected: FAIL because the docs do not yet describe interactive assist behavior.

- [ ] **Step 3: Update the docs**

```md
`assist <profile-path>` now has two modes:

- non-interactive: returns JSON workflow state for scripting and fixtures
- interactive TTY: prompts for the next missing value, writes it directly back into the profile file, creates a one-time `.bak` backup before the first write, and reruns until the workflow reaches `ready`
```

- [ ] **Step 4: Run the harness docs tests to verify they pass**

Run:

```bash
npm run test -- tests/harness/docs-presence.test.ts tests/harness/cli.test.ts
```

Expected: PASS with updated docs and CLI help coverage.

- [ ] **Step 5: Commit**

```bash
git add docs/agent/index.md docs/agent/analysis-workflow.md tests/harness/docs-presence.test.ts tests/harness/cli.test.ts
git commit -m "docs: describe interactive assist workflow"
```

### Task 5: Run the validation ladder

**Files:**
- Verify only

- [ ] **Step 1: Run the focused assist tests**

Run:

```bash
npm run test -- tests/agents/interactive-assist.test.ts tests/agents/cli.test.ts
```

Expected: PASS with the interactive session helper and CLI wiring.

- [ ] **Step 2: Run the harness coverage tests**

Run:

```bash
npm run test -- tests/harness/docs-presence.test.ts tests/harness/cli.test.ts
```

Expected: PASS with updated docs expectations.

- [ ] **Step 3: Run the full repo tests**

Run:

```bash
npm run test
```

Expected: PASS for the full Vitest suite.

- [ ] **Step 4: Run typecheck and harness freshness checks**

Run:

```bash
npm run typecheck
npm run harness:generate
npm run harness:check
```

Expected: PASS for typecheck and generated-doc freshness.

- [ ] **Step 5: Run the PR-equivalent validation and diff check**

Run:

```bash
npm run validate:pr
git diff --check
```

Expected: PASS with no whitespace errors and no failing validation gates.
