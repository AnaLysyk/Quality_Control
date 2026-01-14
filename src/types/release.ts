export type ReleaseSource = "MANUAL" | "API";
export type ReleaseStatus = "DRAFT" | "ACTIVE" | "FINALIZED";

export type Stats = {
  pass: number;
  fail: number;
  blocked: number;
  notRun: number;
};

export type TestCaseCard = {
  id: string;
  title: string;
  status: "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";
  link?: string;
  fromApi: boolean;
};

export type Release = {
  id: string;
  slug: string;
  name: string;
  app: string;
  clientSlug?: string | null;
  environments: string[];
  source: ReleaseSource;
  status: ReleaseStatus;
  runId?: number;
  stats: Stats;
  observations?: string;
  createdAt: string;
  updatedAt: string;
};

export function calcTotal(s: Stats) {
  return s.pass + s.fail + s.blocked + s.notRun;
}

export function calcPercent(s: Stats) {
  const t = calcTotal(s);
  return t ? Math.round((s.pass / t) * 100) : 0;
}
