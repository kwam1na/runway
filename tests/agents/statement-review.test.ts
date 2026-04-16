import { describe, expect, it } from "vitest";
import { ingestStatementsIntoProfile } from "../../src/runway/statement-intake/review.js";
import type { StatementIngestionResult } from "../../src/runway/statement-intake/index.js";

describe("statement review", () => {
  it("requires an explicit APR choice when multiple candidates are found", async () => {
    const prompts: string[] = [];
    const answers = ["yes", "", "", "", "3", "2"];

    const profile = await ingestStatementsIntoProfile({
      profile: {
        debts: [],
      },
      statementPaths: ["/tmp/chase-card.pdf"],
      ask: async (question) => {
        prompts.push(question);
        const answer = answers.shift();

        if (answer === undefined) {
          throw new Error(`Unexpected question: ${question}`);
        }

        return answer;
      },
      extractStatement: async (): Promise<StatementIngestionResult> => ({
        file_path: "/tmp/chase-card.pdf",
        extraction_method: "pdf-text",
        raw_text: "statement text",
        warnings: [],
        errors: [],
        candidates: [
          {
            label: "Chase Card",
            balance: 6400,
            minimum_payment: 220,
            apr_candidates: [
              { label: "purchase apr", apr: 0.2399, confidence: "high" },
              { label: "penalty apr", apr: 0.2999, confidence: "medium" },
            ],
          },
        ],
      }),
    });

    expect(prompts.some((question) => question.includes("multiple APR candidates"))).toBe(true);
    expect(profile).toMatchObject({
      debts: [
        {
          label: "Chase Card",
          balance: 6400,
          minimum_payment: 220,
          apr: 0.2999,
        },
      ],
    });
  });

  it("leaves the profile unchanged when the user skips the extracted debt", async () => {
    const profile = await ingestStatementsIntoProfile({
      profile: {
        debts: [{ id: "existing", label: "Existing Card", balance: 100, apr: 0.1, minimum_payment: 25 }],
      },
      statementPaths: ["/tmp/skip-card.pdf"],
      ask: async () => "no",
      extractStatement: async (): Promise<StatementIngestionResult> => ({
        file_path: "/tmp/skip-card.pdf",
        extraction_method: "pdf-text",
        raw_text: "statement text",
        warnings: [],
        errors: [],
        candidates: [
          {
            label: "Skip Card",
            balance: 6400,
            minimum_payment: 220,
            apr_candidates: [{ label: "purchase apr", apr: 0.2399, confidence: "high" }],
          },
        ],
      }),
    });

    expect(profile).toMatchObject({
      debts: [{ id: "existing", label: "Existing Card", balance: 100, apr: 0.1, minimum_payment: 25 }],
    });
  });
});
