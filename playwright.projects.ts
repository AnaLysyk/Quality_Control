import { devices, type Project } from "@playwright/test";

export const QUALITY_PROJECT_MATCHES = {
  "quality-smoke": ["**/smoke.spec.ts", "**/prod-smoke.spec.ts", "**/happy-path.spec.ts"],
  "quality-access": [
    "**/access-request-first-login.spec.ts",
    "**/access-requests.spec.ts",
    "**/admin-create.spec.ts",
    "**/auth-menu.spec.ts",
    "**/auth-real-login.spec.ts",
    "**/block-non-admin.spec.ts",
    "**/clients-access.spec.ts",
    "**/password-recovery-by-profile.spec.ts",
    "**/persist-active-company.spec.ts",
    "**/requests-flow.spec.ts",
    "**/switch-company.spec.ts",
    "**/user-creation-by-profile.spec.ts",
    "**/user-without-companies.spec.ts",
  ],
  "quality-test-cases": ["**/test-cases-repository.spec.ts", "**/case-repository-profile-cycle.spec.ts"],
  "quality-automation": ["**/automation-studio.spec.ts"],
  "quality-ai": ["**/brain-agents.spec.ts"],
  "quality-runs": [
    "**/business-gate-block.spec.ts",
    "**/business-mttr.spec.ts",
    "**/business-quality-gate.spec.ts",
    "**/business-run-defect.spec.ts",
    "**/defect-link-run.spec.ts",
    "**/defects/**/*.spec.ts",
    "**/mttr-dashboard.spec.ts",
    "**/mttr-manual.spec.ts",
    "**/quality-gate-history.spec.ts",
    "**/quality-goal.spec.ts",
    "**/quality-score.spec.ts",
    "**/quality-trend.spec.ts",
    "**/release-export.spec.ts",
    "**/release-quality-risk.spec.ts",
    "**/release-risk-from-run.spec.ts",
    "**/release-timeline.spec.ts",
    "**/run-drilldown.spec.ts",
    "**/runs/**/*.spec.ts",
    "**/runs-quality.spec.ts",
    "**/sla-dashboard.spec.ts",
  ],
  "quality-dashboards": [
    "**/admin-ranking.spec.ts",
    "**/alerts.spec.ts",
    "**/alerts-dashboard.spec.ts",
    "**/business-benchmark.spec.ts",
    "**/business-export-csv.spec.ts",
    "**/business-export-pdf.spec.ts",
    "**/dashboard-executive.spec.ts",
    "**/documents.spec.ts",
    "**/export-quality.spec.ts",
    "**/health-score.spec.ts",
    "**/trend-dashboard.spec.ts",
  ],
  "quality-ui": [
    "**/mobile-menu.spec.ts",
    "**/playwright-inspired-shell.spec.ts",
    "**/responsive.spec.ts",
    "**/theme-visibility.spec.ts",
  ],
} as const;

const groupedTestMatches = Array.from(new Set(Object.values(QUALITY_PROJECT_MATCHES).flat()));

function desktopChromeUse(browserChannel?: string) {
  return {
    ...devices["Desktop Chrome"],
    ...(browserChannel ? { channel: browserChannel } : {}),
  };
}

export function createQualityProjects(browserChannel?: string): Project[] {
  const use = desktopChromeUse(browserChannel);

  return [
    ...Object.entries(QUALITY_PROJECT_MATCHES).map(([name, testMatch]) => ({
      name,
      testMatch: [...testMatch],
      use,
    })),
    {
      name: "quality-uncategorized",
      testIgnore: groupedTestMatches,
      use,
    },
  ];
}
