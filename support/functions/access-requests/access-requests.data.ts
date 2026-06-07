export function buildAccessRequestPayload(suffix = Date.now()) {
  return {
    profile_type: "technical_support",
    access_type: "technical_support",
    full_name: `Solicitante E2E ${suffix}`,
    name: `Solicitante E2E ${suffix}`,
    email: `solicitante.e2e.${suffix}@demo.test`,
    phone: "11999999999",
    role: "Suporte Técnico",
    job_role: "Suporte Técnico",
    title: "Solicitação de acesso E2E",
    description: "Solicitação criada pelo teste automatizado E2E.",
    notes: "Massa de teste para validar fluxo de solicitação de acesso.",
    password: "Temp@123456",
  };
}

export const accessRequestAdjustment = {
  comment: "Corrigir nome completo e telefone antes da aprovação.",
  fields: ["fullName", "phone"],
};

export const accessRequestReject = {
  reason: "Solicitação rejeitada pelo teste automatizado.",
  comment: "Dados incompatíveis para criação do acesso.",
};
