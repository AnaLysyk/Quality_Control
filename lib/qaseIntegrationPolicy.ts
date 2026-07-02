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
  test_runs: "ExecuÃ§Ãµes / runs",
  test_results: "Resultados",
  defects: "Defeitos",
  evidence: "EvidÃªncias",
  attachments: "Anexos",
  milestones: "Marcos / releases",
  automation_status: "Status de automaÃ§Ã£o",
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
    return "Qase nÃ£o sincroniza dados atÃ© configurar token e projeto.";
  }
  if (policy.mode === "everything") {
    return "IntegraÃ§Ã£o completa: casos, planos, runs, resultados, defeitos, evidÃªncias, anexos, releases e status de automaÃ§Ã£o podem ser enviados ao Qase.";
  }
  return "IntegraÃ§Ã£o seletiva: somente os escopos escolhidos serÃ£o enviados ao Qase.";
}

