# QA Agentic Master Plan

Status: ready-for-implementation
Date: 2026-05-10

Implementation sequencing and delivery backlog:
- docs/ops/QA_AGENTIC_IMPLEMENTATION_BACKLOG.md

## 1. Product Vision
Single source of truth for quality operations.

Core statement:
Test case is the center. Manual, Qase, AI, and Playwright are different ways to create, execute, or automate the same test case.

### Product pillars
- Unified Test Case Repository
- Agentic Automation Workspace
- Execution Intelligence and Reporting
- External integrations: Qase + GitHub
- Governance, security, auditability

## 2. Core Decisions
- Do not split manual and automation into different repositories.
- Keep one canonical entity: `TestCase`.
- Automation is a layer (`TestAutomationLink`) over `TestCase`.
- Definitive automation code lives in GitHub, not in app server storage.
- Qase is an integration source, not an isolated UX silo.

## 3. Canonical Data Model

### Test Case domain
- `TestCase`
- `TestCaseStep`
- `TestCaseExternalSync`
- `TestAutomationLink`

### Planning and manual execution
- `TestPlan`
- `TestPlanCaseLink`
- `ManualTestRun`
- `ManualTestRunResult`

### Playwright execution
- `PlaywrightProject`
- `PlaywrightRun`
- `PlaywrightRunResult`
- `PlaywrightArtifact`

### Agentic workspace
- `AutomationWorkspace`
- `AutomationDraftFile`
- `AutomationAgentRun`

### Integrations and publication
- `QaseIntegration`
- `QaseSyncLog`
- `GitRepositoryLink`
- `GitPublication`

### Failure governance
- `ExecutionFailure` with `failureCategory`:
  - `functional_defect`
  - `automation_error`
  - `environment_error`
  - `test_data_error`
  - `permission_error`
  - `flaky`
  - `unknown`

## 4. Unified Repository UX (`/casos-de-teste`)

### Layout contract
- Top: search + filters + `+ Novo`
- Middle: repository table
- Right/bottom drawer: selected case details
- Tabs in drawer:
  - `Caso`
  - `Passos`
  - `Automacao`
  - `Runs`
  - `Historico`
  - `Assistente`

### `+ Novo` options
- `Caso manual`
- `Caso automatizado Playwright`
- `Gerar com IA`
- `Importar do Qase`

### Automation status lifecycle
- `none`
- `planned`
- `ai_generated`
- `review`
- `approved`
- `linked`
- `published`
- `running`
- `stable`
- `broken`
- `disabled`

## 5. Base Test Case Contract
Mandatory fields for every case type:
- title
- description
- company
- project
- application
- module
- suite
- priority
- severity
- status
- tags
- preconditions
- steps
- expected result per step
- postconditions
- test data
- source

Rule:
No step without expected result.

## 6. Playwright Automation Contract
Additional fields when automation layer exists:
- specFile
- testDescribe
- testTitle
- playwrightProject
- browser/project
- environment
- tags
- command
- pomPath
- fixtureNames
- locatorStrategy
- draft status
- github status
- latest execution status

Locator policy priority:
1. `getByRole`
2. `getByLabel`
3. `getByPlaceholder`
4. `getByText`
5. `getByTestId`
6. `locator()` only with explicit reason

## 7. Qase Integration Contract
Required capabilities:
- list projects
- list suites
- list cases
- create case
- list runs
- list results
- create result

Imported case metadata:
- `source=qase`
- `externalSource=qase`
- `externalProjectCode`
- `externalCaseId`
- `externalUrl`
- `lastSyncedAt`

Security:
Qase token is backend-only.

## 8. Agent Architecture
- `QAAssistantAgent` (orchestrator)
- `TestCaseAgent`
- `QaseIntegrationAgent`
- `PlaywrightPlannerAgent`
- `BrowserExplorerAgent` (Playwright MCP, accessibility snapshot first)
- `SpecGeneratorAgent`
- `LocatorAgent`
- `PomAgent`
- `FixtureAgent`
- `ApiValidationAgent` (APIRequestContext)
- `ReviewAgent`
- `ExecutionAgent`
- `HealingAgent`
- `GitHubPublicationAgent`
- `ReportAgent`

## 9. End-to-End Flows

### Flow A: Create manual case
1. Open repository.
2. Select context (company/project).
3. `+ Novo` > `Caso manual`.
4. Fill base contract.
5. Save.

### Flow B: Create automated case
1. Same as manual.
2. Fill Playwright automation section.
3. Optionally generate AI draft.
4. Save `TestCase + TestCaseStep + TestAutomationLink (+ AutomationDraft)`.

### Flow C: Automate existing manual case
1. Open case.
2. Tab `Automacao`.
3. Start automation workflow for same `testCaseId`.
4. Generate/review/approve draft.
5. Publish to GitHub with confirmation.
6. Update `TestAutomationLink` and lifecycle status.

## 10. Execution Intelligence (`/execucoes`)
Tabs:
- `Manuais/Integracao`
- `Automacao Playwright`
- `Relatorios`

### Reporter and artifacts
Consume and index:
- HTML reporter
- JSON reporter
- JUnit reporter
- Blob reporter
- trace, screenshot, video, logs, network

### Execution metadata
- `executionSource`: `local_runner|server_runner|github_actions|external_ci`
- timeline events (queued, running, steps, artifact, heal, done)
- rerun modes:
  - this test
  - failed only
  - full run
  - project/browser override
  - debug/headed

### Comparison mode
Compare current vs previous run:
- new failures
- fixed failures
- changed pass rate

### Coverage matrix
Per module/project:
- manual count
- automated count
- uncovered count

## 11. Governance Rules

### Quality gates (before stable)
1. Case contract complete
2. Tag traceability present
3. Assertions present (`expect`)
4. Locator policy pass
5. Secret scan pass
6. Execution pass (local or CI)
7. PR created
8. CI checks pass

### Definition of Automation Ready
Case has objective, steps, expected result, test data, context, environment, user profile, route/screen.

### Definition of Automation Done
- `TestAutomationLink` created
- code published to GitHub
- PR/commit tracked
- at least one successful execution
- report and artifacts linked
- case status moved to `stable`

### Known issues and flakiness
- support known issue classification linked to defect
- compute flaky risk from historical variance

### AI audit trail
Log for each AI run:
- actor
- time
- prompt
- agent
- output
- action decision
- applied/discarded/published state

## 12. GitHub Publication Contract
Flow:
1. AI draft
2. QA review
3. QA approval
4. diff preview
5. explicit user confirmation
6. branch commit PR
7. store metadata (`repository`, `branch`, `commitSha`, `pullRequestUrl`, `status`)

Conflict handling when file exists:
- create new file
- overwrite
- patch existing via PR
- cancel

Never publish:
- tokens
- passwords
- cookies
- storageState
- sensitive real data

## 13. Playwright Security Contract
- `storageState` never committed
- `storageState` never included in AI prompts
- isolated runner storage with expiration
- per-profile auth state regeneration

## 14. API Surface (minimum)

### Repository
- `GET /api/test-cases`
- `POST /api/test-cases`
- `GET /api/test-cases/:id`
- `PATCH /api/test-cases/:id`
- `DELETE /api/test-cases/:id`

### Qase
- `GET /api/integrations/qase/projects`
- `GET /api/integrations/qase/:projectCode/suites`
- `GET /api/integrations/qase/:projectCode/cases`
- `POST /api/integrations/qase/:projectCode/cases`
- `POST /api/integrations/qase/sync-cases`
- `GET /api/integrations/qase/:projectCode/runs`
- `GET /api/integrations/qase/:projectCode/results`
- `POST /api/integrations/qase/:projectCode/results`

### Automation workspace
- `POST /api/test-cases/:id/automation/workspace`
- `GET /api/automation-workspaces/:workspaceId`
- `PATCH /api/automation-workspaces/:workspaceId`
- `GET /api/automation-workspaces/:workspaceId/files`
- `POST /api/automation-workspaces/:workspaceId/files`
- `PATCH /api/automation-workspaces/:workspaceId/files/:fileId`
- `POST /api/automation-workspaces/:workspaceId/files/:fileId/approve`

### Agents
- `POST /api/automation-workspaces/:workspaceId/agents/plan`
- `POST /api/automation-workspaces/:workspaceId/agents/explore`
- `POST /api/automation-workspaces/:workspaceId/agents/generate-spec`
- `POST /api/automation-workspaces/:workspaceId/agents/generate-pom`
- `POST /api/automation-workspaces/:workspaceId/agents/generate-fixture`
- `POST /api/automation-workspaces/:workspaceId/agents/review`
- `POST /api/automation-workspaces/:workspaceId/agents/heal`

### GitHub
- `GET /api/companies/:companySlug/git-repositories`
- `POST /api/companies/:companySlug/git-repositories`
- `POST /api/automation-workspaces/:workspaceId/github/prepare`
- `POST /api/automation-workspaces/:workspaceId/github/publish`
- `GET /api/automation-workspaces/:workspaceId/github/status`

### Executions
- `GET /api/executions`
- `GET /api/executions/:id`
- `GET /api/executions/:id/report`
- `GET /api/executions/:id/artifacts`
- `POST /api/manual-runs`
- `POST /api/manual-runs/:id/results`
- `POST /api/playwright-runs`
- `GET /api/playwright-runs/:id`
- `GET /api/playwright-runs/:id/events`
- `GET /api/playwright-runs/:id/artifacts`

## 15. Current Sprint Delta (implemented and validated)
- Full build fixed and passing.
- Weekly review endpoint now uses real gap sources for:
  - defects without run
  - cases without plan
- Contract tests added and passing:
  - `tests/brain-ingest-contract.test.ts`
  - `tests/brain-commands-confirmation.test.ts`

## 16. Copilot Master Prompt (compact)
Use this block directly in Copilot:

```text
Implement a unified QA Agentic platform with a single Test Case Repository as canonical source.
Do not split manual and automation repositories.

Core model:
- TestCase is central.
- Manual/Qase/AI/Playwright are source/layer attributes.
- Automation is linked via TestAutomationLink.

Main UX:
- /casos-de-teste with filters, +Novo, table, and case drawer tabs.
- +Novo options: manual, automated Playwright, generate with AI, import from Qase.

Automation flow:
- Same testCaseId opens automation workspace.
- AI can plan/explore/generate/review/heal.
- QA approval is required before GitHub publication.
- Show diff and require explicit confirmation before branch/commit/PR.
- Definitive code lives in GitHub.

Executions:
- Tabs: manual/integration, playwright automation, reports.
- Ingest Playwright HTML/JSON/JUnit/Blob reports and artifacts.
- Classify failures by category (functional vs automation vs environment etc).
- Add timeline, rerun modes, run comparison, and coverage matrix.

Governance:
- quality gates before stable status.
- definition of automation ready/done.
- known issue and flaky tracking.
- full AI audit trail.

Security:
- backend-only Qase/GitHub tokens.
- never expose storageState in prompts/artifacts/git.

Deliver in phased slices with API contracts and tests for each slice.
```
