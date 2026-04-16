import { describe, expect, it } from "vitest";
import { runCli } from "../../src/runway/cli.js";

describe("runway cli", () => {
  it("lists supported harness commands", async () => {
    const result = await runCli(["help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("assist");
    expect(result.stdout).toContain("web");
    expect(result.stdout).toContain("generate");
    expect(result.stdout).toContain("audit");
    expect(result.stdout).toContain("scorecard");
  });

  it("rejects unknown commands", async () => {
    const result = await runCli(["unknown"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown command");
  });
});
