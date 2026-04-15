# Runway Bootstrap Design

## Summary

Bootstrap `/Users/kwamina/Desktop/agent` as a git-backed, CLI-first Python repository for `runway`, an agentic system to assist in personal finances. The initial repository must be usable as both:

- the implementation home for runway scripts, agent workflows, checks, generators, and scenario runners
- the first harnessed target that future agents can navigate, validate, and repair while the product surface is still forming

The design optimizes for uncertain early product runtime needs. It does not force an early service or worker abstraction, but it leaves clean expansion points for both as runway grows beyond its first CLI-first tooling layer.

## Goals

- Initialize the repository as a git-backed Python project for runway.
- Establish a repo-level and local navigation layer for future agents.
- Make the first runway package itself the first documented and validated target.
- Generate machine-readable validation coverage and discovery docs from Python source-of-truth data.
- Provide repo-level harness commands for generation, checking, review, audit, behavior runs, scorecards, and repair.
- Add CI and harness self-tests so the harness can detect its own drift.

## Non-Goals

- Building a production service, daemon, or worker in the first bootstrap.
- Adding a full multi-package monorepo layout before it is needed.
- Adding semantic or LLM-backed review logic as a blocking requirement in the first version.

## Recommended Approach

Adopt a CLI-first Python repository for runway with a built-in agent harness.

This keeps the first version small and flexible:

- the repository exposes a Python CLI entrypoint for harness operations
- runtime behavior is modeled as structured CLI scenarios rather than a long-running server contract
- future services, workers, or additional packages can be added as new harness registry entries without reshaping the base repo
- the first implementation focus stays on agent-oriented workflows and repository health rather than prematurely locking runway into a delivery channel

## Repository Shape

The repository should start with one main Python package and one local agent manual rooted at the repo level.

```text
agent/
├── .github/
│   └── workflows/
├── AGENTS.md
├── README.md
├── artifacts/
├── docs/
│   ├── agent/
│   │   ├── architecture.md
│   │   ├── code-map.md
│   │   ├── index.md
│   │   ├── testing.md
│   │   ├── entry-index.md
│   │   ├── key-folder-index.md
│   │   ├── test-index.md
│   │   ├── validation-guide.md
│   │   └── validation-map.json
│   └── superpowers/
│       └── specs/
├── graphify-out/
├── pyproject.toml
├── scripts/
├── src/
│   └── runway/
│       ├── cli.py
│       ├── finance/
│       ├── harness/
│       ├── agents/
│       └── scenarios/
└── tests/
```

This repo does not create a fake app directory solely to satisfy the harness pattern. Instead, the repo-level `docs/agent/` folder acts as the local operating manual for the first harnessed target: the runway package itself.

## Navigation Model

Future agents should enter through root `AGENTS.md`.

`AGENTS.md` must explain:

- that this repo is the home of runway, an agentic personal-finance system
- where generated navigation output lives
- that agents should read `docs/agent/index.md` before scanning source
- when graph and index artifacts must be regenerated
- which commands maintain harness health

The generated navigation layer should include:

- a repo wiki or index in `graphify-out/`
- an app or package landing page for the runway package
- generated discovery indexes in `docs/agent/`

Generated navigation should be rebuilt, not hand-maintained.

## Harness Architecture

The harness should follow a single pattern:

`source-of-truth Python data -> generated docs and artifacts -> verification commands`

Authoritative sources:

- `src/runway/harness/app_registry.py`
  Declares harnessed targets, audited roots, expected docs, key folders, and validation surfaces.
- `src/runway/scenarios/inventory.py`
  Declares runtime or behavior scenarios in structured Python data.
- Hand-maintained docs:
  - `AGENTS.md`
  - `docs/agent/index.md`
  - `docs/agent/architecture.md`
  - `docs/agent/testing.md`
  - `docs/agent/code-map.md`

Derived outputs:

- `docs/agent/entry-index.md`
- `docs/agent/test-index.md`
- `docs/agent/key-folder-index.md`
- `docs/agent/validation-guide.md`
- `docs/agent/validation-map.json`
- `graphify-out/*`
- `artifacts/*`

## Initial Harnessed Target

The first and only required target during bootstrap is the runway package.

Recommended target shape:

- label: `runway`
- path: `src/runway`
- archetype: `library`
- onboarding status: active
- audited roots:
  - `src/runway`
  - `docs/agent`
  - `tests`
  - `.github/workflows`
- required docs:
  - `docs/agent/index.md`
  - `docs/agent/architecture.md`
  - `docs/agent/testing.md`
  - `docs/agent/code-map.md`
- key folder groups:
  - CLI entrypoints
  - finance domain logic
  - agent workflows
  - harness logic
  - scenario definitions
  - tests
  - generated docs

Although the archetype is modeled as `library` for harness purposes, the package still exposes a CLI. This choice keeps the validation and documentation model simple while avoiding premature service assumptions about how runway will ultimately serve users.

## Command Surface

The repository should expose a single CLI with subcommands or equivalent script entrypoints for:

- `harness generate`
- `harness check`
- `harness review`
- `harness audit`
- `harness behavior`
- `harness inferential-review`
- `harness runtime-trends`
- `harness scorecard`
- `harness janitor`
- `harness test`

Expected responsibilities:

- `generate`
  Regenerate derived docs, validation coverage data, and navigation outputs.
- `check`
  Validate that required docs, links, paths, commands, and scenario references exist.
- `review`
  Read changed files and select the smallest honest validation set from the generated validation map.
- `audit`
  Scan live files under audited roots and fail on uncovered surfaces, stale references, or missing generated outputs.
- `behavior`
  Execute structured runtime scenarios and emit machine-readable reports under `artifacts/`.
- `inferential-review`
  Start with deterministic checks and leave room for future shadow semantic findings.
- `runtime-trends`
  Summarize historical behavior artifacts.
- `scorecard`
  Summarize harness health, graph freshness, audit status, and runtime history.
- `janitor`
  Run drift sensors in report mode and optionally perform safe repair operations such as regeneration.
- `test`
  Run harness self-tests.

## Validation Coverage Model

Validation coverage should be generated from registry data, not hand-maintained in JSON only.

`docs/agent/validation-map.json` should be emitted from Python definitions so that:

- the human-maintained docs and machine-readable coverage derive from the same inputs
- review and audit logic can trust one source of truth
- uncovered changed files are treated as harness bugs rather than skipped work

Initial validation surfaces should include:

- `src/runway/cli.py`
- `src/runway/finance/`
- `src/runway/agents/`
- `src/runway/harness/`
- `src/runway/scenarios/`
- `docs/agent/`
- `tests/`
- `.github/workflows/`

Each surface should declare:

- name
- path prefixes
- commands
- optional behavior scenarios
- optional rationale

The local testing guide must explain how to repair:

- a changed file with no validation coverage
- a live file under an audited root with no validation coverage

## Runtime Scenario Model

Because the repo is CLI-first, the initial scenario set should focus on non-destructive executable behavior rather than HTTP or queue flows.

The first required scenario is:

- `cli-runway-smoke`

Recommended behavior:

- invoke the CLI
- verify the command tree loads successfully
- run a safe read-only or generation-oriented command
- assert that expected outputs are produced
- emit a machine-readable behavior report to `artifacts/`

Future service, worker, or browser scenarios can be added later as new inventory entries without changing the base harness contract.

As the product becomes clearer, additional scenarios can represent user-observable finance workflows such as ingestion, categorization, planning, or reporting. Those should only be added when the corresponding product surfaces exist.

## Documentation Model

Required hand-maintained docs:

- `AGENTS.md`
- `docs/agent/index.md`
- `docs/agent/architecture.md`
- `docs/agent/testing.md`
- `docs/agent/code-map.md`

Required generated docs:

- `docs/agent/entry-index.md`
- `docs/agent/test-index.md`
- `docs/agent/key-folder-index.md`
- `docs/agent/validation-guide.md`
- `docs/agent/validation-map.json`

Generated docs must clearly state that they are generated and should be regenerated rather than edited manually.

## CI Model

CI should run runway's harness as both a user-facing system and a self-policing system.

The bootstrap should include workflow wiring that:

- installs Python dependencies
- runs harness self-tests
- runs `harness check`
- runs touched-file review against a base when available
- runs `harness audit`
- runs `harness inferential-review`
- runs `harness scorecard`
- checks graph freshness
- uploads generated artifacts

The repo should also expose one umbrella local command that approximates PR validation.

## Testing Strategy

Harness self-tests should verify at minimum:

- registry entries resolve to real paths
- generated docs contain required sections and expected references
- validation maps reference real paths and invokable commands
- review selection chooses validations for changed files
- audit detects uncovered files
- scenario inventory stays documented in both code and local docs
- CI wiring contains the required harness steps

## Delivery Sequence

Bootstrap should proceed in this order:

1. Initialize git and Python project metadata.
2. Create root navigation and local agent docs.
3. Create the `src/runway` package skeleton and CLI entrypoint.
4. Add the harness registry, generators, checks, review and audit logic, and behavior scenario inventory.
5. Generate derived docs and validation coverage.
6. Add harness self-tests and CI.
7. Run the local validation flow and leave the repo reproducible.

## Risks And Mitigations

### Risk: Overcommitting to a runtime too early

Mitigation:

- treat the repo as CLI-first
- represent runtime behavior through structured scenarios
- add services or workers later as explicit new targets

### Risk: Drift between docs and executable checks

Mitigation:

- generate validation coverage and discovery docs from Python source-of-truth data
- make audit fail on uncovered or stale surfaces

### Risk: Harness overhead outruns repo value

Mitigation:

- keep the first target singular
- prefer thin, deterministic implementations for review, audit, and behavior
- defer semantic review lanes until the deterministic lane is solid

## Success Criteria

Bootstrap is successful when:

- the repo is initialized in git
- an agent can start at `AGENTS.md` and reach the correct local docs without guesswork
- the runway package is registered as a documented and validated target
- generated discovery docs and validation coverage can be rebuilt deterministically
- changed files can be mapped to an honest validation set
- uncovered files fail audit
- at least one executable CLI scenario emits a machine-readable artifact
- CI runs the harness and publishes artifacts
