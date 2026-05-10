# QA Agentic Implementation Backlog

Status: execution-ready
Date: 2026-05-10
Source: docs/ops/QA_AGENTIC_MASTER_PLAN.md

## 1. Delivery strategy
Ship in vertical slices, always ending each slice with:
- build green
- focused tests green
- demo flow executable by QA

Priority levels:
- P0: foundation and unblockers
- P1: core product workflow
- P2: execution intelligence and governance
- P3: optimization and scale

## 2. Phase map

### Phase P0 (1 sprint)
Goal: harden current baseline and guarantee repository-first model.

Outcomes:
- Single canonical repository stable in UI and API.
- Automation link lifecycle works without case duplication.
- Contract tests in place for critical flows.

### Phase P1 (1-2 sprints)
Goal: complete end-to-end user workflows.

Outcomes:
- Manual case flow complete.
- Automated case flow complete.
- Automate existing manual case flow complete.
- Qase import and sync in repository.

### Phase P2 (2 sprints)
Goal: execution intelligence + governance.

Outcomes:
- Execution tabs and timeline.
- Reporter ingestion (html/json/junit/blob) and artifact indexing.
- Failure triage and defect linkage.
- Quality gates and done criteria enforced.

### Phase P3 (ongoing)
Goal: reliability, productivity, and maintainability.

Outcomes:
- Learning mode from human edits.
- Flakiness risk scoring maturity.
- Comparison and trend dashboards.
- Performance and cost controls.

## 3. Detailed backlog

## P0 - Foundation and unblockers

### Epic P0.1 Repository integrity
- P0.1.1 Ensure all create/update flows resolve to TestCase canonical model.
  - Acceptance: no route creates detached automation-only case records.
- P0.1.2 Enforce step + expectedResult validation in API.
  - Acceptance: API rejects step payload with missing expected result.
- P0.1.3 Normalize source/type/automationStatus enums.
  - Acceptance: API and UI share same allowed values.

### Epic P0.2 Automation link stability
- P0.2.1 Guarantee automate action always targets existing testCaseId.
  - Acceptance: linking automation updates same case, no duplicate by title.
- P0.2.2 Ensure draft lifecycle transitions are deterministic.
  - Acceptance: draft -> review -> approved -> linked -> published path supported.
- P0.2.3 Add anti-dup checks on link creation.
  - Acceptance: same spec/tag pair cannot be linked twice without confirmation.

### Epic P0.3 Safety and contracts
- P0.3.1 Keep ingest contract tests for allowed/custom events.
- P0.3.2 Keep command confirmation contract tests for high-risk commands.
- P0.3.3 Add CI target for brain contract tests.
  - Acceptance: contract suite runs in pipeline and fails on regression.

## P1 - Core product workflows

### Epic P1.1 Unified repository UX
- P1.1.1 Finalize /casos-de-teste filters and table behavior.
- P1.1.2 Finalize drawer tabs: Caso, Passos, Automacao, Runs, Historico, Assistente.
- P1.1.3 Finalize +Novo menu options with clear routing.
  - Acceptance: all 4 create options are available and functional.

### Epic P1.2 Manual case flow
- P1.2.1 Base form parity with product contract fields.
- P1.2.2 Step builder with mandatory expected result.
- P1.2.3 Save/edit/archive permissions by company scope.
  - Acceptance: company user cannot mutate out-of-scope case.

### Epic P1.3 Automated case flow
- P1.3.1 Add automation section in create/edit modal.
- P1.3.2 Save TestCase + TestCaseStep + TestAutomationLink atomically.
- P1.3.3 Add generate draft from case context action.
  - Acceptance: generated draft includes spec, command, tags and review metadata.

### Epic P1.4 Automate existing manual case
- P1.4.1 Open workspace from selected case.
- P1.4.2 Generate/review/approve/link flow in case context.
- P1.4.3 Publish to GitHub with explicit confirmation and diff preview.
  - Acceptance: PR metadata saved and case status updated.

### Epic P1.5 Qase integration in repository
- P1.5.1 List projects and suites.
- P1.5.2 Import selected cases as internal TestCase.
- P1.5.3 Sync updates and run/result snapshots.
  - Acceptance: imported records have external metadata fields populated.

## P2 - Execution intelligence and governance

### Epic P2.1 Executions page redesign
- P2.1.1 Build /execucoes tabs:
  - Manual/Integration
  - Playwright Automation
  - Reports
- P2.1.2 Shared filters: company/project/period/responsible/status.
- P2.1.3 Execution detail panel with timeline and artifacts.
  - Acceptance: each execution shows chronological event stream.

### Epic P2.2 Reporter ingestion pipeline
- P2.2.1 Ingest Playwright html/json/junit/blob report metadata.
- P2.2.2 Index artifacts (trace/screenshot/video/log/network).
- P2.2.3 Link GitHub run artifacts to execution records.
  - Acceptance: execution detail opens report and artifact links.

### Epic P2.3 Failure triage
- P2.3.1 Add failureCategory field and UI triage actions.
- P2.3.2 Add actions: open defect, mark automation error, send to healing, rerun.
- P2.3.3 Persist triage decisions with actor and timestamp.
  - Acceptance: failures can be filtered by category and decision state.

### Epic P2.4 Quality gates
- P2.4.1 Implement pre-stable gate checks.
- P2.4.2 Enforce definition of automation ready.
- P2.4.3 Enforce definition of automation done.
  - Acceptance: case cannot transition to stable unless all gates pass.

### Epic P2.5 Governance and audit
- P2.5.1 Persist AI run audit (prompt, agent, output, actor, decision).
- P2.5.2 Persist publish consent logs and diff confirmation.
- P2.5.3 Add known issue + flaky tracking in execution reports.
  - Acceptance: every AI/publish action is fully auditable.

## P3 - Optimization and scale

### Epic P3.1 Smart rerun and comparison
- P3.1.1 Rerun modes: single, failed-only, full run, browser override, debug/headed.
- P3.1.2 Run comparison: new failures, fixed failures, pass-rate delta.
- P3.1.3 Coverage matrix by module/project.

### Epic P3.2 Learning mode
- P3.2.1 Capture human edits after AI generation.
- P3.2.2 Propose project conventions from accepted edits.
- P3.2.3 Apply conventions as optional generation constraints.

### Epic P3.3 Platform hardening
- P3.3.1 Runner isolation and retention tuning.
- P3.3.2 Artifact lifecycle cleanup jobs.
- P3.3.3 Cost/performance telemetry by execution source.

## 4. API implementation checklist

## Repository
- [ ] GET /api/test-cases
- [ ] POST /api/test-cases
- [ ] GET /api/test-cases/:id
- [ ] PATCH /api/test-cases/:id
- [ ] DELETE /api/test-cases/:id

## Qase
- [ ] GET /api/integrations/qase/projects
- [ ] GET /api/integrations/qase/:projectCode/suites
- [ ] GET /api/integrations/qase/:projectCode/cases
- [ ] POST /api/integrations/qase/:projectCode/cases
- [ ] POST /api/integrations/qase/sync-cases
- [ ] GET /api/integrations/qase/:projectCode/runs
- [ ] GET /api/integrations/qase/:projectCode/results
- [ ] POST /api/integrations/qase/:projectCode/results

## Automation workspace
- [ ] POST /api/test-cases/:id/automation/workspace
- [ ] GET /api/automation-workspaces/:workspaceId
- [ ] PATCH /api/automation-workspaces/:workspaceId
- [ ] GET /api/automation-workspaces/:workspaceId/files
- [ ] POST /api/automation-workspaces/:workspaceId/files
- [ ] PATCH /api/automation-workspaces/:workspaceId/files/:fileId
- [ ] POST /api/automation-workspaces/:workspaceId/files/:fileId/approve

## Agents
- [ ] POST /api/automation-workspaces/:workspaceId/agents/plan
- [ ] POST /api/automation-workspaces/:workspaceId/agents/explore
- [ ] POST /api/automation-workspaces/:workspaceId/agents/generate-spec
- [ ] POST /api/automation-workspaces/:workspaceId/agents/generate-pom
- [ ] POST /api/automation-workspaces/:workspaceId/agents/generate-fixture
- [ ] POST /api/automation-workspaces/:workspaceId/agents/review
- [ ] POST /api/automation-workspaces/:workspaceId/agents/heal

## GitHub
- [ ] GET /api/companies/:companySlug/git-repositories
- [ ] POST /api/companies/:companySlug/git-repositories
- [ ] POST /api/automation-workspaces/:workspaceId/github/prepare
- [ ] POST /api/automation-workspaces/:workspaceId/github/publish
- [ ] GET /api/automation-workspaces/:workspaceId/github/status

## Executions
- [ ] GET /api/executions
- [ ] GET /api/executions/:id
- [ ] GET /api/executions/:id/report
- [ ] GET /api/executions/:id/artifacts
- [ ] POST /api/manual-runs
- [ ] POST /api/manual-runs/:id/results
- [ ] POST /api/playwright-runs
- [ ] GET /api/playwright-runs/:id
- [ ] GET /api/playwright-runs/:id/events
- [ ] GET /api/playwright-runs/:id/artifacts

## 5. Test plan by phase

### P0 test pack
- Contract tests:
  - brain ingest contract
  - command confirmation contract
- Build + smoke API routes for test-case and brain endpoints.

### P1 test pack
- E2E profile cycle:
  - create case -> link plan -> create run
- E2E automation link:
  - manual case -> automate -> same case id
- Qase import flow tests.

### P2 test pack
- Execution timeline rendering tests.
- Reporter ingestion parser tests.
- Failure triage state transition tests.
- Gate enforcement tests.

## 6. Suggested Copilot handoff prompt per phase

### Prompt P0
Implement P0 epics from docs/ops/QA_AGENTIC_IMPLEMENTATION_BACKLOG.md.
Focus on repository integrity, automation-link stability, and contract tests.
Do not add new UX scope. Keep changes localized and production-safe.

### Prompt P1
Implement P1 epics from docs/ops/QA_AGENTIC_IMPLEMENTATION_BACKLOG.md.
Deliver fully functional user flows in /casos-de-teste and workspace-to-github path.
Include API + UI + tests for each flow.

### Prompt P2
Implement P2 epics from docs/ops/QA_AGENTIC_IMPLEMENTATION_BACKLOG.md.
Build execution intelligence in /execucoes, reporter ingestion, failure triage, and quality gates.
Include traceable audit logs and defect linkage.

## 7. Definition of done for each merged slice
- Build passes.
- Targeted tests pass.
- No regression in existing brain routes.
- Permissions/scoping validated.
- Changelog entry added to docs/ops.
