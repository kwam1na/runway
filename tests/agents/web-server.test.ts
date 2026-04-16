import { afterEach, describe, expect, it } from "vitest";
import { startRunwayWebServer } from "../../src/runway/web/server.js";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanup.length > 0) {
    const next = cleanup.pop();
    if (next) {
      await next();
    }
  }
});

describe("runway web server", () => {
  it("serves the browser shell and workflow state", async () => {
    const server = await startRunwayWebServer({ port: 0 });
    cleanup.push(server.close);

    const html = await fetch(`${server.url}/`).then((response) => response.text());
    const script = await fetch(`${server.url}/app.js`).then((response) => response.text());
    const state = await fetch(`${server.url}/api/state`).then((response) => response.json());

    expect(html).toContain("Runway");
    expect(html).toContain("step-rail");
    expect(script).toContain("renderApp");
    expect(state.profilePath).toMatch(/runway-profile/);
    expect(Array.isArray(state.steps)).toBe(true);
  });

  it("persists browser profile updates through the api", async () => {
    const server = await startRunwayWebServer({ port: 0 });
    cleanup.push(server.close);

    const updated = await fetch(`${server.url}/api/profile`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        profile: {
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
        },
      }),
    }).then((response) => response.json());

    expect(updated.profile.cash_position.available_cash).toBe(18000);
    expect(updated.steps.find((step: { id: string }) => step.id === "plan")?.status).toBe("current");
  });

  it("responds cleanly to the browser favicon request", async () => {
    const server = await startRunwayWebServer({ port: 0 });
    cleanup.push(server.close);

    const response = await fetch(`${server.url}/favicon.ico`);

    expect(response.status).toBe(204);
  });
});
