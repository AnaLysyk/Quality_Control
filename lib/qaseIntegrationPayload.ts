import { buildQaseIntegrationPolicy, type QaseSyncMode, type QaseSyncScope } from "@/lib/qaseIntegrationPolicy";

export type QaseIntegrationPayloadInput = {
  token?: string | null;
  projectCodes?: string[] | null;
  defaultProjectCode?: string | null;
  mode?: QaseSyncMode | null;
  scopes?: QaseSyncScope[] | null;
};

export function buildQaseIntegrationPayload(input: QaseIntegrationPayloadInput) {
  const token = input.token?.trim() || null;
  const policy = buildQaseIntegrationPolicy({
    hasToken: Boolean(token),
    projectCodes: input.projectCodes,
    defaultProjectCode: input.defaultProjectCode,
    mode: input.mode,
    scopes: input.scopes,
  });

  const integrationMode = token || policy.projectCodes.length ? "qase" : "manual";
  const qaseProjectCode = policy.defaultProjectCode ?? undefined;
  const qaseProjectCodes = policy.projectCodes;

  return {
    integrationMode,
    qaseToken: token ?? undefined,
    qaseProjectCode,
    qaseProjectCodes,
    qaseSyncMode: policy.mode,
    qaseSyncScopes: policy.scopes,
    sendEverythingToQase: policy.sendEverythingToQase,
    integrations: integrationMode === "qase"
      ? [
          {
            type: "QASE",
            config: {
              token,
              projects: qaseProjectCodes,
              defaultProject: qaseProjectCode ?? null,
              syncMode: policy.mode,
              syncScopes: policy.scopes,
              sendEverything: policy.sendEverythingToQase,
            },
          },
        ]
      : [],
  };
}

