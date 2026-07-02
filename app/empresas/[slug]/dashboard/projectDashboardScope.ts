import { normalizeDefectStatus } from "@/lib/defectNormalization";
import type { CompanyDashboardData } from "./companyDashboardData";

type DashboardScopeInput = {
  projectSlug?: string | null;
  projectCode?: string | null;
};

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProjectCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function initials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "PR";
}

function maxDate(values: Array<string | null | undefined>) {
  const latest = values
    .map((value) => (value ? Date.parse(value) : 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => right - left)[0];

  return latest ? new Date(latest).toISOString() : null;
}

function uniqueProjectCodes(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeProjectCode(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function buildCandidateKeys(values: unknown[]) {
  return new Set(values.map((value) => normalizeKey(value)).filter(Boolean));
}

function buildCandidateCodes(values: unknown[]) {
  return new Set(values.map((value) => normalizeProjectCode(value)).filter(Boolean) as string[]);
}

export function applyProjectDashboardScope(
  data: CompanyDashboardData,
  scope: DashboardScopeInput,
): CompanyDashboardData {
  const requestedProjectSlug = normalizeKey(scope.projectSlug);
  const requestedProjectCode = normalizeProjectCode(scope.projectCode);

  if (!requestedProjectSlug && !requestedProjectCode) return data;

  const selectedApplication =
    data.applications.find((application) => {
      const applicationKeys = buildCandidateKeys([application.slug, application.name, application.id]);
      const applicationCodes = buildCandidateCodes([application.qaseProjectCode]);
      return Boolean(
        (requestedProjectSlug && applicationKeys.has(requestedProjectSlug)) ||
          (requestedProjectCode && applicationCodes.has(requestedProjectCode)),
      );
    }) ?? null;

  const projectName = selectedApplication?.name ?? requestedProjectCode ?? requestedProjectSlug ?? "Projeto";
  const projectSlug = selectedApplication?.slug ?? requestedProjectSlug ?? normalizeKey(projectName);
  const projectCode = normalizeProjectCode(selectedApplication?.qaseProjectCode) ?? requestedProjectCode;
  const projectKeys = buildCandidateKeys([
    projectSlug,
    projectName,
    selectedApplication?.id,
    selectedApplication?.slug,
    selectedApplication?.name,
    selectedApplication?.qaseProjectCode,
    projectCode,
  ]);
  const projectCodes = buildCandidateCodes([projectCode, selectedApplication?.qaseProjectCode, projectSlug]);

  function matchesProject(values: unknown[], codes: unknown[] = []) {
    const keys = buildCandidateKeys(values);
    const normalizedCodes = buildCandidateCodes(codes);

    for (const key of keys) {
      if (projectKeys.has(key)) return true;
    }
    for (const code of normalizedCodes) {
      if (projectCodes.has(code)) return true;
    }
    return false;
  }

  const runs = data.runs.filter((run) =>
    matchesProject(
      [run.applicationKey, run.applicationName, run.projectCode, run.slug, run.title, run.releaseLabel],
      [run.projectCode],
    ),
  );

  const defects = data.defects.filter((defect) =>
    matchesProject(
      [defect.applicationKey, defect.applicationName, defect.projectCode, defect.runSlug, defect.runName, defect.title],
      [defect.projectCode],
    ),
  );

  const applications = data.applications.filter((application) =>
    matchesProject(
      [application.id, application.slug, application.name, application.qaseProjectCode],
      [application.qaseProjectCode],
    ),
  );

  const alerts = data.alerts.filter((alert) => {
    const metadata = alert.metadata ?? {};
    return matchesProject(
      [
        metadata.projectSlug,
        metadata.project,
        metadata.application,
        metadata.applicationSlug,
        metadata.applicationName,
        metadata.projectCode,
        metadata.qaseProjectCode,
      ],
      [metadata.projectCode, metadata.qaseProjectCode],
    );
  });

  const fallbackApplication = selectedApplication
    ? []
    : [
        {
          id: projectCode ? `qase_${projectCode.toLowerCase()}` : `project_${projectSlug}`,
          name: projectName,
          slug: projectSlug,
          description: "Operação de qualidade do projeto selecionado.",
          imageUrl: null,
          qaseProjectCode: projectCode,
          source: projectCode ? "qase" : "manual",
          active: true,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      ];

  const scopedApplications = applications.length > 0 ? applications : fallbackApplication;

  return {
    ...data,
    companyName: `${data.companyName} · ${projectName}`,
    companyInitials: initials(projectName),
    subtitle: `Dashboard do projeto ${projectName}. Métricas, runs, defeitos e indicadores filtrados pela operação deste projeto dentro da empresa ${data.companyName}.`,
    heroStats: {
      ...data.heroStats,
      total: runs.length,
      inProgress: runs.filter((run) => !run.isCompleted).length,
      completed: runs.filter((run) => run.isCompleted).length,
      manual: runs.filter((run) => run.sourceType === "manual").length,
      integration: runs.filter((run) => run.sourceType === "integration").length,
      latestExecutionAt: maxDate(runs.flatMap((run) => [run.updatedAt, run.createdAt])),
      alerts: alerts.length,
      openDefects: defects.filter((defect) => normalizeDefectStatus(defect.statusRaw) !== "done").length,
      applications: scopedApplications.length,
    },
    runs,
    defects,
    alerts,
    applications: scopedApplications,
    projectCodes: uniqueProjectCodes([projectCode, ...scopedApplications.map((application) => application.qaseProjectCode)]),
  };
}

