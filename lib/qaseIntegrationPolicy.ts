export type QaseSyncMode = "disabled" | "selected" | "everything";

export type QaseSyncScope =
  | "test_cases"
  | "test_plans"
  | "test_runs"
  | "test_results"
  | "defects"
  | "evidence"
  | "attachments"
  | "milestones"
  | "automation_status";

export type QaseIntegrationPolicy = {
  mode: QaseSyncMode;
  scopes: QaseSyncScope[];
  defaultProjectCode?: string | null;
  projectCodes: string[];
  sendEverythingToQase: boolean;
};

export const QASE_SYNC_SCOPE_LABELS: Record<QaseSyncScope, string> = {
  test_cases: "Casos de teste",
  test_plans: "Planos de teste",
  test_runs: "Execuções / runs",
  test_results: "Resultados",
  defects: "Defeitos",
  evidence: "Evidências",
  attachments: "Anexos",
  milestones: "Marcos / releases",
  automation_status: "Status de automação",
};

export const QASE_EVERYTHING_SCOPES: QaseSyncScope[] = [
  "test_cases",
  "test_plans",
  "test_runs",
  "test_results",
  "defects",
  "evidence",
  "attachments",
  "milestones",
  "automation_status",
];

export const QASE_SELECTED_DEFAULT_SCOPES: QaseSyncScope[] = [
  "test_cases",
  "test_runs",
  "test_results",
  "defects",
  "evidence",
];

function uniqueScopes(scopes: QaseSyncScope[]) {
  return Array.from(new Set(scopes));
}

function uniqueProjectCodes(projectCodes: string[]) {
  return Array.from(new Set(projectCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)));
}

export function buildQaseIntegrationPolicy(input: {
  hasToken: boolean;
  projectCodes?: string[] | null;
  defaultProjectCode?: string | null;
  mode?: QaseSyncMode | null;
  scopes?: QaseSyncScope[] | null;
}): QaseIntegrationPolicy {
  const projectCodes = uniqueProjectCodes(input.projectCodes ?? []);
  const canSync = input.hasToken && projectCodes.length > 0;
  const requestedMode = input.mode ?? (canSync ? "selected" : "disabled");
  const mode: QaseSyncMode = canSync ? requestedMode : "disabled";
  const sendEverythingToQase = mode === "everything";
  const scopes = mode === "disabled"
    ? []
    : sendEverythingToQase
      ? QASE_EVERYTHING_SCOPES
      : uniqueScopes(input.scopes?.length ? input.scopes : QASE_SELECTED_DEFAULT_SCOPES);

  return {
    mode,
    scopes,
    defaultProjectCode: input.defaultProjectCode?.trim().toUpperCase() || projectCodes[0] || null,
    projectCodes,
    sendEverythingToQase,
  };
}

export function describeQaseIntegrationPolicy(policy: QaseIntegrationPolicy) {
  if (policy.mode === "disabled") {
    return "Qase não sincroniza dados até configurar token e projeto.";
  }
  if (policy.mode === "everything") {
    return "Integração completa: casos, planos, runs, resultados, defeitos, evidências, anexos, releases e status de automação podem ser enviados ao Qase.";
  }
  return "Integração seletiva: somente os escopos escolhidos serão enviados ao Qase.";
}
