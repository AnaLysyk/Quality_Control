import { obterSenhaTesteSolicitacaoAcesso } from "../../../api/solicitar-acesso/autenticacao/autenticar-revisor";

export function montarPayloadSolicitacaoAcesso(suffix = Date.now()) {
  return {
    profile_type: "technical_support",
    access_type: "technical_support",
    full_name: `Ana E2E ${suffix}`,
    name: `Ana E2E ${suffix}`,
    email: `solicitante.e2e.${suffix}@demo.test`,
    phone: "11999999999",
    role: "Suporte TÃ©cnico",
    job_role: "Suporte TÃ©cnico",
    title: "SolicitaÃ§Ã£o de acesso para validaÃ§Ã£o",
    description: "SolicitaÃ§Ã£o criada para validar o fluxo de acesso.",
    notes: "Massa isolada para validar o fluxo de solicitaÃ§Ã£o de acesso.",
    password: obterSenhaTesteSolicitacaoAcesso(),
  };
}

export const dadosAjusteSolicitacao = {
  comment: "Corrigir nome completo e telefone antes da aprovaÃ§Ã£o.",
  fields: ["fullName", "phone"],
};

export const dadosRecusaSolicitacao = {
  reason: "SolicitaÃ§Ã£o recusada durante a validaÃ§Ã£o do fluxo.",
  comment: "Dados incompatÃ­veis para criaÃ§Ã£o do acesso.",
};

