export type Tone = "positive" | "warning" | "critical" | "neutral";

export type HomeStatusBadge = {
  title: string;
  detail: string;
  tone: Tone;
};

export type RunSourceType = "manual" | "integration";

export type RunIntegrationProvider = "qase" | "jira" | null;

export type HomeRunStats = {
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
  total: number;
  passRate: number | null;
};

export type HomeRunItem = {
  id: string;
  slug: string;
  runId: number | null;
  title: string;
  href: string;
  applicationKey: string;
  applicationName: string;
  projectCode: string | null;
  environments: string[];
  sourceType: RunSourceType;
  integrationProvider: RunIntegrationProvider;
  statusRaw: string | null;
  statusLabel: string;
  statusTone: Tone;
  isCompleted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  summary: string | null;
  stats: HomeRunStats;
  releaseLabel: string | null;
  responsibleLabel: string | null;
};

export type CompanyRunsHeroStats = {
  total: number;
  inProgress: number;
  completed: number;
  manual: number;
  integration: number;
  latestExecutionAt: string | null;
  alerts: number;
  openDefects: number;
  applications: number;
};
