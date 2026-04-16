import { access, copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { runAgentWorkflow, type AgentWorkflowOutcome } from "../agents/index.js";
import type { LocalFinancialProfileInput, PlannerResult } from "../finance/index.js";
import { resolveDefaultProfilePath } from "../interactive-assist.js";
import {
  extractStatementText,
  mergeConfirmedStatementCandidate,
  normalizeStatementText,
  type StatementDebtCandidate,
} from "../statement-intake/index.js";

export type BrowserStepId =
  | "statements"
  | "cash"
  | "obligations"
  | "debts"
  | "income"
  | "review"
  | "plan";

export type BrowserStepState = {
  id: BrowserStepId;
  label: string;
  status: "completed" | "current" | "upcoming" | "locked";
  issueCount: number;
};

export type BrowserSessionState = {
  profilePath: string;
  profile: LocalFinancialProfileInput;
  outcome: AgentWorkflowOutcome["status"];
  steps: BrowserStepState[];
  validationIssues: Array<{ path: string; message: string; question?: string }>;
  followUpQuestions: Array<{ path: string; question?: string }>;
  analysisResult?: PlannerResult;
  report?: string;
};

export type UploadedStatementFile = {
  name: string;
  type?: string;
  contentBase64: string;
};

export type ExtractedStatementFile = {
  fileName: string;
  extractionMethod?: string;
  warnings: string[];
  errors: string[];
  candidates: StatementDebtCandidate[];
};

export type BrowserSession = {
  getState(): BrowserSessionState;
  saveProfile(profile: LocalFinancialProfileInput): Promise<BrowserSessionState>;
  mergeStatementCandidates(candidates: StatementDebtCandidate[]): Promise<BrowserSessionState>;
  extractStatements(files: UploadedStatementFile[]): Promise<ExtractedStatementFile[]>;
};

export type BrowserSessionOptions = {
  profilePath?: string;
};

const stepOrder: Array<{ id: BrowserStepId; label: string }> = [
  { id: "statements", label: "Statements" },
  { id: "cash", label: "Cash" },
  { id: "obligations", label: "Obligations" },
  { id: "debts", label: "Debts" },
  { id: "income", label: "Income" },
  { id: "review", label: "Review" },
  { id: "plan", label: "Plan" },
];

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function readProfile(profilePath: string): Promise<LocalFinancialProfileInput> {
  try {
    return JSON.parse(await readFile(profilePath, "utf8")) as LocalFinancialProfileInput;
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }

    throw error;
  }
}

async function ensureBackup(profilePath: string, previousProfile: LocalFinancialProfileInput): Promise<void> {
  const backupPath = `${profilePath}.bak`;

  try {
    await access(backupPath);
    return;
  } catch {}

  try {
    await copyFile(profilePath, backupPath);
  } catch (error) {
    if (isMissingFileError(error)) {
      await writeFile(backupPath, `${JSON.stringify(previousProfile, null, 2)}\n`, "utf8");
      return;
    }

    throw error;
  }
}

async function writeProfile(profilePath: string, profile: LocalFinancialProfileInput): Promise<void> {
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

function cloneProfile(profile: LocalFinancialProfileInput): LocalFinancialProfileInput {
  return {
    ...profile,
    cash_position: profile.cash_position ? { ...profile.cash_position } : undefined,
    monthly_obligations: profile.monthly_obligations ? { ...profile.monthly_obligations } : undefined,
    debts: profile.debts?.map((debt) => ({ ...debt })),
    income_assumptions: profile.income_assumptions ? { ...profile.income_assumptions } : undefined,
    planning_preferences: profile.planning_preferences ? { ...profile.planning_preferences } : undefined,
  };
}

function stepForPath(path: string): BrowserStepId {
  if (path.startsWith("cash_position.")) {
    return "cash";
  }

  if (path.startsWith("monthly_obligations.")) {
    return "obligations";
  }

  if (path.startsWith("debts[")) {
    return "debts";
  }

  if (path.startsWith("income_assumptions.")) {
    return "income";
  }

  return "review";
}

function computeActionableStep(profile: LocalFinancialProfileInput, outcome: AgentWorkflowOutcome): BrowserStepId {
  if (
    profile.cash_position?.available_cash === undefined ||
    profile.cash_position?.reserved_cash === undefined ||
    profile.cash_position?.severance_total === undefined
  ) {
    return "cash";
  }

  if (
    profile.monthly_obligations?.essentials === undefined ||
    profile.monthly_obligations?.discretionary === undefined
  ) {
    return "obligations";
  }

  if (profile.debts === undefined) {
    return "debts";
  }

  if (profile.income_assumptions?.expected_monthly_income === undefined) {
    return "income";
  }

  if (outcome.status === "needs-input") {
    const nextPath = outcome.followUpQuestions[0]?.path ?? outcome.validationIssues[0]?.path;
    return nextPath ? stepForPath(nextPath) : "review";
  }

  return "plan";
}

function buildSteps(profile: LocalFinancialProfileInput, outcome: AgentWorkflowOutcome): BrowserStepState[] {
  const actionable = computeActionableStep(profile, outcome);
  const actionableIndex = stepOrder.findIndex((step) => step.id === actionable);
  const issueCounts = new Map<BrowserStepId, number>();

  if (outcome.status === "needs-input") {
    for (const issue of outcome.validationIssues) {
      const step = stepForPath(issue.path);
      issueCounts.set(step, (issueCounts.get(step) ?? 0) + 1);
    }
  }

  return stepOrder.map((step, index) => {
    if (step.id === "statements") {
      return {
        ...step,
        status: "completed",
        issueCount: issueCounts.get(step.id) ?? 0,
      };
    }

    if (step.id === "plan") {
      return {
        ...step,
        status: outcome.status === "ready" ? "current" : "locked",
        issueCount: issueCounts.get(step.id) ?? 0,
      };
    }

    if (index < actionableIndex) {
      return {
        ...step,
        status: "completed",
        issueCount: issueCounts.get(step.id) ?? 0,
      };
    }

    if (index === actionableIndex) {
      return {
        ...step,
        status: "current",
        issueCount: issueCounts.get(step.id) ?? 0,
      };
    }

    return {
      ...step,
      status: "upcoming",
      issueCount: issueCounts.get(step.id) ?? 0,
    };
  });
}

function buildState(profilePath: string, profile: LocalFinancialProfileInput, outcome: AgentWorkflowOutcome): BrowserSessionState {
  return {
    profilePath,
    profile: cloneProfile(profile),
    outcome: outcome.status,
    steps: buildSteps(profile, outcome),
    validationIssues:
      outcome.status === "needs-input"
        ? outcome.validationIssues.map((issue) => ({
            path: issue.path,
            message: issue.message,
            question: issue.question,
          }))
        : [],
    followUpQuestions:
      outcome.status === "needs-input"
        ? outcome.followUpQuestions.map((issue) => ({
            path: issue.path,
            question: issue.question,
          }))
        : [],
    analysisResult: outcome.status === "ready" ? outcome.result : undefined,
    report: outcome.status === "ready" ? outcome.report : undefined,
  };
}

async function writeUploadedStatement(file: UploadedStatementFile): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "runway-web-upload-"));
  const filePath = resolve(dir, file.name);
  await writeFile(filePath, Buffer.from(file.contentBase64, "base64"));
  return filePath;
}

export async function createBrowserSession(options: BrowserSessionOptions): Promise<BrowserSession> {
  const profilePath = options.profilePath ?? (await resolveDefaultProfilePath());
  let profile = await readProfile(profilePath);

  const getWorkflowState = (): BrowserSessionState => buildState(profilePath, profile, runAgentWorkflow(profile));

  return {
    getState() {
      return getWorkflowState();
    },

    async saveProfile(nextProfile) {
      const previousProfile = cloneProfile(profile);
      await ensureBackup(profilePath, previousProfile);
      profile = cloneProfile(nextProfile);
      await writeProfile(profilePath, profile);
      return getWorkflowState();
    },

    async mergeStatementCandidates(candidates) {
      const previousProfile = cloneProfile(profile);
      await ensureBackup(profilePath, previousProfile);
      let nextProfile = cloneProfile(profile);

      for (const candidate of candidates) {
        nextProfile = mergeConfirmedStatementCandidate(nextProfile, candidate);
      }

      profile = nextProfile;
      await writeProfile(profilePath, profile);
      return getWorkflowState();
    },

    async extractStatements(files) {
      const extractedFiles: ExtractedStatementFile[] = [];

      for (const file of files) {
        const filePath = await writeUploadedStatement(file);

        try {
          const extracted = await extractStatementText(filePath);
          extractedFiles.push({
            fileName: file.name,
            extractionMethod: extracted.extraction_method,
            warnings: extracted.warnings,
            errors: extracted.errors,
            candidates:
              extracted.candidates.length > 0
                ? extracted.candidates
                : extracted.raw_text
                  ? normalizeStatementText({ filePath, rawText: extracted.raw_text })
                  : [],
          });
        } finally {
          await rm(dirname(filePath), { recursive: true, force: true });
        }
      }

      return extractedFiles;
    },
  };
}
