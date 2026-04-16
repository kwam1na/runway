const appState = {
  session: null,
  activeStep: "statements",
  extractedFiles: [],
};

function numberOrUndefined(value) {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

async function loadSession() {
  appState.session = await request("/api/state");
  const current = appState.session.steps.find((step) => step.status === "current");
  appState.activeStep = current?.id ?? "statements";
}

function stepButton(step) {
  return `
    <button class="step-link step-${step.status}" data-step-id="${step.id}">
      <span>${step.label}</span>
      ${step.issueCount > 0 ? `<strong>${step.issueCount}</strong>` : ""}
    </button>
  `;
}

function renderRail() {
  const rail = document.getElementById("step-rail");
  rail.innerHTML = `
    <div class="step-rail-header">
      <p class="eyebrow">Profile</p>
      <h2>${appState.session.profilePath.split("/").pop()}</h2>
      <p class="lede-small">${appState.session.profilePath}</p>
    </div>
    ${appState.session.steps.map(stepButton).join("")}
  `;

  rail.querySelectorAll("[data-step-id]").forEach((button) => {
    button.addEventListener("click", () => {
      appState.activeStep = button.dataset.stepId;
      renderApp();
    });
  });
}

function inputField(label, name, value, type = "number") {
  return `
    <label class="field">
      <span>${label}</span>
      <input type="${type}" name="${name}" value="${value ?? ""}" />
    </label>
  `;
}

function candidateMarkup(candidate, fileIndex, candidateIndex) {
  const aprMarkup =
    candidate.apr_candidates.length > 0
      ? `
        <label class="field">
          <span>APR</span>
          <select data-file-index="${fileIndex}" data-candidate-index="${candidateIndex}" data-field="selected_apr">
            <option value="">Choose APR</option>
            ${candidate.apr_candidates.map((aprCandidate) => `
              <option value="${aprCandidate.apr ?? ""}">
                ${(aprCandidate.label ?? "apr").trim()} • ${
                  aprCandidate.apr !== undefined ? `${(aprCandidate.apr * 100).toFixed(2)}%` : "unknown"
                }
              </option>
            `).join("")}
          </select>
        </label>
      `
      : inputField("APR", "selected_apr", candidate.selected_apr);

  return `
    <section class="candidate" data-file-index="${fileIndex}" data-candidate-index="${candidateIndex}">
      <label class="checkbox">
        <input type="checkbox" data-field="include" checked />
        <span>Merge this debt</span>
      </label>
      <div class="field-grid">
        ${inputField("Label", "label", candidate.label, "text")}
        ${inputField("Balance", "balance", candidate.balance)}
        ${inputField("Minimum payment", "minimum_payment", candidate.minimum_payment)}
        ${aprMarkup}
      </div>
    </section>
  `;
}

function renderStatements() {
  return `
    <section class="panel">
      <h2>Statements</h2>
      <p class="section-copy">Upload statement files first if you want Runway to seed the debt list before manual entry.</p>
      <label class="upload-zone">
        <input id="statement-upload" type="file" accept=".pdf,.png,.jpg,.jpeg" multiple />
        <span>Select PDF or image statements</span>
      </label>
      <div class="actions">
        <button class="primary" id="extract-statements">Extract debt candidates</button>
      </div>
      ${appState.extractedFiles.map((file, fileIndex) => `
        <section class="panel">
          <h3>${file.fileName}</h3>
          <p class="section-copy">${file.extractionMethod ?? "unknown method"}</p>
          ${(file.warnings ?? []).map((warning) => `<p class="notice">${warning}</p>`).join("")}
          ${(file.errors ?? []).map((error) => `<p class="error">${error}</p>`).join("")}
          ${(file.candidates ?? []).map((candidate, candidateIndex) => candidateMarkup(candidate, fileIndex, candidateIndex)).join("")}
        </section>
      `).join("")}
      ${appState.extractedFiles.length > 0 ? '<div class="actions"><button class="primary" id="merge-statements">Merge reviewed debts</button></div>' : ""}
    </section>
  `;
}

function renderCash() {
  const cash = appState.session.profile.cash_position ?? {};
  return `
    <form class="panel" id="cash-form">
      <h2>Cash</h2>
      <p class="section-copy">Capture the liquid cash Runway can reason about today.</p>
      <div class="field-grid">
        ${inputField("Available cash", "available_cash", cash.available_cash)}
        ${inputField("Reserved cash", "reserved_cash", cash.reserved_cash)}
        ${inputField("Severance cash", "severance_total", cash.severance_total)}
      </div>
      <div class="actions"><button class="primary" type="submit">Save cash</button></div>
    </form>
  `;
}

function renderObligations() {
  const obligations = appState.session.profile.monthly_obligations ?? {};
  return `
    <form class="panel" id="obligations-form">
      <h2>Obligations</h2>
      <p class="section-copy">Keep burn rate explicit before the planner makes any debt suggestions.</p>
      <div class="field-grid">
        ${inputField("Essentials", "essentials", obligations.essentials)}
        ${inputField("Discretionary", "discretionary", obligations.discretionary)}
      </div>
      <div class="actions"><button class="primary" type="submit">Save obligations</button></div>
    </form>
  `;
}

function debtFormMarkup(debt, index) {
  return `
    <section class="candidate">
      <div class="field-grid">
        ${inputField("Label", `label-${index}`, debt.label, "text")}
        ${inputField("Balance", `balance-${index}`, debt.balance)}
        ${inputField("APR", `apr-${index}`, debt.apr)}
        ${inputField("Minimum payment", `minimum_payment-${index}`, debt.minimum_payment)}
      </div>
    </section>
  `;
}

function renderDebts() {
  const debts = appState.session.profile.debts ?? [];
  return `
    <form class="panel" id="debts-form">
      <h2>Debts</h2>
      <p class="section-copy">You can edit any merged debts here or add manual ones if statements did not cover everything.</p>
      <div id="debt-list">
        ${debts.map(debtFormMarkup).join("")}
      </div>
      <div class="actions">
        <button class="secondary" type="button" id="add-debt">Add debt</button>
        <button class="primary" type="submit">Save debts</button>
      </div>
    </form>
  `;
}

function renderIncome() {
  const income = appState.session.profile.income_assumptions ?? {};
  return `
    <form class="panel" id="income-form">
      <h2>Income</h2>
      <p class="section-copy">Future income stays out of the plan until you explicitly confirm it.</p>
      <div class="field-grid">
        ${inputField("Expected monthly income", "expected_monthly_income", income.expected_monthly_income)}
      </div>
      <label class="checkbox">
        <input type="checkbox" name="income_is_confirmed" ${income.income_is_confirmed ? "checked" : ""} />
        <span>Confirmed enough to include in runway planning</span>
      </label>
      <div class="actions"><button class="primary" type="submit">Save income</button></div>
    </form>
  `;
}

function renderReview() {
  return `
    <section class="panel">
      <h2>Review</h2>
      <p class="section-copy">The remaining questions here are coming from the shared validator.</p>
      ${appState.session.validationIssues.length === 0
        ? "<p>No remaining validation gaps.</p>"
        : appState.session.validationIssues.map((issue) => `
            <article class="issue">
              <h3>${issue.path}</h3>
              <p>${issue.message}</p>
              ${issue.question ? `<p class="notice">${issue.question}</p>` : ""}
            </article>
          `).join("")}
    </section>
  `;
}

function renderPlan() {
  if (!appState.session.analysisResult) {
    return `
      <section class="panel">
        <h2>Plan</h2>
        <p class="section-copy">Complete the remaining steps to unlock the shared runway analysis.</p>
      </section>
    `;
  }

  const result = appState.session.analysisResult;
  return `
    <section class="panel">
      <h2>Plan</h2>
      <div class="stats-grid">
        <div><span>Liquid cash</span><strong>${result.snapshot.liquid_cash}</strong></div>
        <div><span>Monthly burn</span><strong>${result.snapshot.monthly_burn}</strong></div>
        <div><span>Runway months</span><strong>${result.snapshot.runway_months}</strong></div>
      </div>
      <section class="plan-block">
        <h3>Immediate actions</h3>
        <ul>${result.recommended_immediate_actions.map((action) => `<li>${action.summary}</li>`).join("")}</ul>
      </section>
      <section class="plan-block">
        <h3>Monthly plan</h3>
        <ul>${result.monthly_plan.map((entry) => `<li>Month ${entry.month}: ${entry.starting_cash} → ${entry.ending_cash}</li>`).join("")}</ul>
      </section>
      <section class="plan-block">
        <h3>Report</h3>
        <pre>${appState.session.report ?? ""}</pre>
      </section>
    </section>
  `;
}

function renderWorkspace() {
  const container = document.getElementById("workspace-content");

  const sections = {
    statements: renderStatements(),
    cash: renderCash(),
    obligations: renderObligations(),
    debts: renderDebts(),
    income: renderIncome(),
    review: renderReview(),
    plan: renderPlan(),
  };

  container.innerHTML = sections[appState.activeStep] ?? renderStatements();
}

function readCandidateValue(candidateNode, selector) {
  const element = candidateNode.querySelector(selector);
  return element ? element.value : undefined;
}

function collectCandidatesForMerge() {
  return appState.extractedFiles.flatMap((file, fileIndex) =>
    (file.candidates ?? []).flatMap((candidate, candidateIndex) => {
      const candidateNode = document.querySelector(
        `.candidate[data-file-index="${fileIndex}"][data-candidate-index="${candidateIndex}"]`,
      );

      if (!candidateNode) {
        return [];
      }

      const include = candidateNode.querySelector(`input[data-field="include"]`);
      if (!include?.checked) {
        return [];
      }

      return [
        {
          ...candidate,
          label: readCandidateValue(candidateNode, `input[name="label"]`) ?? candidate.label,
          balance: numberOrUndefined(readCandidateValue(candidateNode, `input[name="balance"]`)) ?? candidate.balance,
          minimum_payment:
            numberOrUndefined(readCandidateValue(candidateNode, `input[name="minimum_payment"]`)) ??
            candidate.minimum_payment,
          selected_apr:
            numberOrUndefined(readCandidateValue(candidateNode, `select[data-field="selected_apr"]`)) ??
            numberOrUndefined(readCandidateValue(candidateNode, `input[name="selected_apr"]`)) ??
            candidate.selected_apr,
        },
      ];
    }),
  );
}

async function saveProfile(profile) {
  appState.session = await request("/api/profile", {
    method: "PUT",
    body: JSON.stringify({ profile }),
  });
  const current = appState.session.steps.find((step) => step.status === "current");
  appState.activeStep = current?.id ?? appState.activeStep;
  renderApp();
}

function collectDebts() {
  return [...document.querySelectorAll("#debt-list .candidate")].map((candidateNode, index) => ({
    id: appState.session.profile.debts?.[index]?.id ?? `debt-${index + 1}`,
    label: readCandidateValue(candidateNode, `input[name="label-${index}"]`),
    balance: numberOrUndefined(readCandidateValue(candidateNode, `input[name="balance-${index}"]`)),
    apr: numberOrUndefined(readCandidateValue(candidateNode, `input[name="apr-${index}"]`)),
    minimum_payment: numberOrUndefined(readCandidateValue(candidateNode, `input[name="minimum_payment-${index}"]`)),
  }));
}

function bindActions() {
  document.getElementById("extract-statements")?.addEventListener("click", async () => {
    const input = document.getElementById("statement-upload");
    const files = [...(input?.files ?? [])];
    const uploads = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        type: file.type,
        contentBase64: btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer()))),
      })),
    );

    const payload = await request("/api/statements/extract", {
      method: "POST",
      body: JSON.stringify({ files: uploads }),
    });

    appState.extractedFiles = payload.files;
    renderApp();
  });

  document.getElementById("merge-statements")?.addEventListener("click", async () => {
    appState.session = await request("/api/statements/merge", {
      method: "POST",
      body: JSON.stringify({
        candidates: collectCandidatesForMerge(),
      }),
    });
    appState.extractedFiles = [];
    appState.activeStep = "debts";
    renderApp();
  });

  document.getElementById("cash-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfile({
      ...appState.session.profile,
      cash_position: {
        available_cash: numberOrUndefined(event.currentTarget.available_cash.value),
        reserved_cash: numberOrUndefined(event.currentTarget.reserved_cash.value),
        severance_total: numberOrUndefined(event.currentTarget.severance_total.value),
      },
    });
  });

  document.getElementById("obligations-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfile({
      ...appState.session.profile,
      monthly_obligations: {
        essentials: numberOrUndefined(event.currentTarget.essentials.value),
        discretionary: numberOrUndefined(event.currentTarget.discretionary.value),
      },
    });
  });

  document.getElementById("add-debt")?.addEventListener("click", () => {
    appState.session.profile.debts = [...(appState.session.profile.debts ?? []), {}];
    renderApp();
  });

  document.getElementById("debts-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfile({
      ...appState.session.profile,
      debts: collectDebts(),
    });
  });

  document.getElementById("income-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProfile({
      ...appState.session.profile,
      income_assumptions: {
        expected_monthly_income: numberOrUndefined(event.currentTarget.expected_monthly_income.value),
        income_is_confirmed: event.currentTarget.income_is_confirmed.checked,
      },
    });
  });
}

function renderApp() {
  renderRail();
  renderWorkspace();
  bindActions();
}

await loadSession();
renderApp();
