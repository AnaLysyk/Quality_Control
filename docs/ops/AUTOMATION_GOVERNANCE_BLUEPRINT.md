# Automation Governance Blueprint

Status: draft-v1
Date: 2026-05-09

## Goal
Turn the current assistant-driven script generation flow into a governed automation platform with traceability, approvals, secure execution, and CI/GitHub lifecycle integration.

## Core Principle
Draft != Official Automation.

Pipeline:
1. AI generates draft
2. QA review
3. QA approval
4. Secure publish to GitHub (branch + PR)
5. CI validation
6. Official automation state update
7. Runtime evidence + reporting

## Maturity Model
- none
- planned
- ai_generated
- review
- approved
- linked
- published
- running
- stable
- broken
- disabled

## Foundational Entities
- TestCaseVersion
- AutomationVersion
- AutomationDraft
- AutomationApproval
- AutomationQualityScore
- AutomationEnvironment
- AutomationExecutionProfile
- AssistantPromptTemplate (versioned)
- AssistantPromptRun
- AutomationAgentRun
- AgentToolCall
- AgentGuardrailEvent
- GitRepositoryLink
- AutomationRunLink (internal run <-> GitHub Actions run)

## Mandatory Gates
### Auto actions (low risk)
- generate-manual-case
- suggest-steps
- generate-draft
- review-script
- suggest-locators
- analyze-failure

### Approval-required actions (high risk)
- publish GitHub
- create PR
- execute in real environment
- alter official script
- disable automation
- auto-heal apply

## Quality Rules
Automation Quality Score dimensions:
- locators
- assertions
- pom
- fixtures
- traceability
- flakiness risk
- security

Minimum publish gate:
- case tag present
- expect present
- command starts with npx playwright test
- no real secrets
- locator policy validated

## Locator Policy
Priority order:
1. getByRole
2. getByLabel
3. getByPlaceholder
4. getByText
5. getByTestId
6. locator() as last resort

Block by default unless justified:
- nth()
- xpath selectors
- fragile css chains

## data-testid Contract
- Mandatory for new testable UI
- Stable naming
- No breaking changes without migration
- Stored in a catalog page and validated in review

## MCP Modes
- Generate mode: case -> spec/pom/fixture
- Explore mode: snapshot -> refs -> locator map -> script recommendation

Capabilities by use:
- Explore simple: core + testing
- Login/session: core + testing + storage
- API validation: core + network + storage
- Debug/healing: core + devtools + network
- Visual/image: core + vision (only when needed)

## Environment Contract
Supported:
- local
- dev
- homolog
- staging
- production_controlled

Per environment:
- baseURL
- companySlug
- project
- featureFlags
- allowWrite
- allowDestructive

## Security
- Store storageState outside git
- Keep playwright/.auth ignored
- Never store real credential payload in drafts or artifacts metadata
- Prefer GitHub App over static token
- Repo allowlist and minimum permissions

## Execution Architecture
- Isolated runner (ephemeral container)
- Resource limits
- Timeout
- Command allowlist
- Disposable workspace

Allowed commands:
- npx playwright test ...
- npx playwright show-report
- npx playwright show-trace

## Event Stream
Emit:
- run.started
- agent.message
- browser.opened
- step.started
- step.passed
- step.failed
- artifact.created
- run.finished

Transport:
- SSE (phase 1) or WebSocket (phase 2)

## Artifacts and Retention
Policy baseline:
- all artifacts: 7 days
- failed runs: 30 days
- release evidence: 90 days
- external CI artifacts: keep links only when configured

## GitHub Lifecycle
- safe publish with diff preview
- explicit user confirmation
- create branch + PR
- PR status tracking
- checks/workflow status via webhook
- map internalRunId <-> githubRunId

## Permissions
- ai:testcase:generate
- ai:playwright:generate
- ai:playwright:explore
- ai:playwright:review
- ai:playwright:heal
- automation:workspace:create
- automation:github:publish
- automation:run:execute
- automation:artifact:view

## Guardrails
- PermissionGuardrail
- SecretGuardrail
- ScopeGuardrail
- DestructiveActionGuardrail
- CodeQualityGuardrail
- GitHubPublishGuardrail
- CommandGuardrail
- StorageStateGuardrail

## Prompt Templates
Versioned templates:
- generate-manual-case
- generate-automated-case
- generate-playwright-spec
- explore-with-mcp
- review-playwright-script
- heal-playwright-failure
- generate-qase-sync-summary

Each template must define:
- inputSchema
- outputSchema
- active version

## Definition of Done (Automation)
Automation becomes official only if:
- linked to test case
- case tag present
- expect present
- POM/fixture validated when needed
- local or CI pass
- secret scan pass
- published to GitHub
- PR/commit linked
- execution evidence available

## Delivery Plan
### Phase A (done/ongoing)
- drafts + review/heal + explicit publish confirm
- real GitHub branch/commit/PR integration
- draft status transitions in UI

### Phase B (next)
- maturity states across repository UI and filters
- approval state machine
- quality score + locator policy gate
- output schema validation before persisting draft

### Phase C
- environments + execution profiles + data manager + cleanup
- isolated sandbox runner + event stream
- retention policy + QA report

### Phase D
- GitHub App + webhook sync + PR/check lifecycle
- internal run to Actions run mapping
- file tree visualization + conflict handling + soft locks

### Phase E
- permissions hardening + guardrail registry + full tracing
- prompt template registry + project memory and guidelines
- e2e tests of the automation platform itself
