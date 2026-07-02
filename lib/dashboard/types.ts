export type DashboardScopeKind = "global" | "internal" | "company";

export type DashboardCompanyOption = {
  id?: string;
  slug: string;
  name: string;
  locked?: boolean;
};

export type DashboardContextLabels = {
  companyLabel?: string | null;
  applicationLabel?: string | null;
  moduleLabel?: string | null;
  periodLabel?: string | null;
};

export type DashboardContextValue = {
  userId: string | null;
  role: string;
  scope: DashboardScopeKind;
  allowedCompanies: DashboardCompanyOption[];
  allowedCompanySlugs: string[];
  selectedCompanySlugs: string[];
  fixedCompanySlug: string | null;
  canSelectCompany: boolean;
  canSelectMultipleCompanies: boolean;
  canSelectAllCompanies: boolean;
  companySelectorMode: "hidden" | "locked" | "select";
  labels: DashboardContextLabels;
  contextLabel: string;
};

export type DashboardMetricCard = {
  id: string;
  label: string;
  value: string | number;
  note?: string;
  tone?: "default" | "positive" | "warning" | "critical";
};

