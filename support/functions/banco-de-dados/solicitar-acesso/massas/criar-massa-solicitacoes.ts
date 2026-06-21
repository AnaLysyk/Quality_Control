import { obterSenhaTesteSolicitacaoAcesso } from "../../../api/solicitar-acesso/autenticacao/autenticar-revisor";

export function montarPayloadSolicitacaoAcesso(suffix = Date.now()) {
  return {
    profile_type: "technical_support",
    access_type: "technical_support",
    full_name: `Ana E2E ${suffix}`,
    name: `Ana E2E ${suffix}`,
    email: `solicitante.e2e.${suffix}@demo.test`,
    phone: "11999999999",
    role: "Suporte Técnico",
    job_role: "Suporte Técnico",
    title: "Solicitação de acesso para validação",
    description: "Solicitação criada para validar o fluxo de acesso.",
    notes: "Massa isolada para validar o fluxo de solicitação de acesso.",
    password: obterSenhaTesteSolicitacaoAcesso(),
  };
}

export const dadosAjusteSolicitacao = {
  comment: "Corrigir nome completo e telefone antes da aprovação.",
  fields: ["fullName", "phone"],
};

export const dadosRecusaSolicitacao = {
  reason: "Solicitação recusada durante a validação do fluxo.",
  comment: "Dados incompatíveis para criação do acesso.",
};
