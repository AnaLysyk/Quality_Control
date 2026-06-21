import { expect, type APIRequestContext } from "@playwright/test";

import { validarContratoApi } from "../../contratos/validar-contrato-api";
import {
  criarSolicitacaoAcessoResponseSchema,
  solicitacaoAcessoDuplicadaResponseSchema,
} from "../contratos/solicitacao-acesso-response.schema";
import { obterSenhaTesteSolicitacaoAcesso } from "./autenticar-revisor";
import { esperarEmailCapturado } from "./capturar-emails";

export type DadosSolicitacaoAcessoPublica = {
  requestType: string;
  requestedRole: string;
  requestedCompanyId?: string;
  requestedCompanySlug?: string;
  requesterName: string;
  requesterEmail: string;
  email: string;
  full_name: string;
  name: string;
  user: string;
  phone: string;
  company?: string;
  client_id?: string;
  role: string;
  profile_type: string;
  title: string;
  description: string;
  password: string;
  reason: string;
  priority: string;
};

export type PerfilSolicitacaoAcessoPublica =
  | "empresa"
  | "company_user"
  | "testing_company_user"
  | "leader_tc"
  | "technical_support";

export type OpcoesSolicitacaoAcessoPublica = {
  requestedRole?: PerfilSolicitacaoAcessoPublica;
  requestedCompanyId?: string;
  requestedCompanySlug?: string;
};

export function montarPayloadSolicitacaoPublica(
  email: string,
  opcoes: OpcoesSolicitacaoAcessoPublica = {},
): DadosSolicitacaoAcessoPublica {
  const suffix = Date.now();
  const requestedRole = opcoes.requestedRole ?? "technical_support";

  const tituloPorPerfil: Record<PerfilSolicitacaoAcessoPublica, string> = {
    empresa: "Solicitação de acesso empresarial",
    company_user: "Solicitação de acesso como usuário da empresa",
    testing_company_user: "Solicitação de acesso como usuário TC",
    leader_tc: "Solicitação de acesso como líder TC",
    technical_support: "Solicitação de acesso como suporte técnico",
  };

  const descricaoPorPerfil: Record<PerfilSolicitacaoAcessoPublica, string> = {
    empresa: "Solicitação criada para validar o ciclo de aprovação de acesso empresarial.",
    company_user: "Solicitação criada para validar o ciclo de aprovação de usuário vinculado à empresa.",
    testing_company_user: "Solicitação criada para validar o ciclo de aprovação de usuário TC.",
    leader_tc: "Solicitação criada para validar o ciclo de aprovação de líder TC.",
    technical_support: "Solicitação criada para validar o ciclo de aprovação de suporte técnico.",
  };

  const payload: DadosSolicitacaoAcessoPublica = {
    requestType: requestedRole,
    requestedRole,
    requesterName: `Ana E2E ${suffix}`,
    requesterEmail: email,
    email,
    full_name: `Ana E2E ${suffix}`,
    name: `Ana E2E ${suffix}`,
    user: `qa.e2e.${suffix}`,
    phone: "51999999999",
    role: "Analista de QA",
    profile_type: requestedRole,
    title: tituloPorPerfil[requestedRole],
    description: descricaoPorPerfil[requestedRole],
    password: obterSenhaTesteSolicitacaoAcesso(),
    reason: descricaoPorPerfil[requestedRole],
    priority: "medium",
  };

  if (requestedRole === "empresa") {
    Object.assign(payload, {
      companyName: "NEXT COMPANY TECNOLOGIA LTDA",
      company_name: "NEXT COMPANY TECNOLOGIA LTDA",
      fantasyName: "Next Company",
      fantasy_name: "Next Company",
      cnpj: "19131243000197",
      companyDocument: "19131243000197",
      company_document: "19131243000197",
      taxId: "19131243000197",
      tax_id: "19131243000197",
      cep: "01001-000",
      address: "Praça da Sé",
      number: "100",
      city: "São Paulo",
      state: "SP",
      company: "NEXT COMPANY TECNOLOGIA LTDA",
    });
  }

  if (opcoes.requestedCompanyId) {
    payload.requestedCompanyId = opcoes.requestedCompanyId;
    payload.client_id = opcoes.requestedCompanyId;
  }

  if (opcoes.requestedCompanySlug) {
    payload.requestedCompanySlug = opcoes.requestedCompanySlug;
    payload.company = opcoes.requestedCompanySlug;
  }

  return payload;
}

export async function criarSolicitacaoPublicaViaApi(
  request: APIRequestContext,
  payload: DadosSolicitacaoAcessoPublica,
) {
  const response = await request.post("/api/access-requests/public", {
    data: payload,
  });

  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(201);
  validarContratoApi(
    criarSolicitacaoAcessoResponseSchema,
    body,
    "POST /api/access-requests/public - 201",
  );
  expect(body?.item?.id).toBeTruthy();
  expect(body?.item?.requesterEmail).toBe(payload.email);
  expect(body?.item?.accessKey).toBeUndefined();

  const captured = await esperarEmailCapturado({
    to: payload.email,
    subject: /Solicita.*acesso recebida - Quality Control/i,
  });
  const emailContent = `${captured.html}\n${captured.text ?? ""}`;
  const accessKey =
    emailContent.match(/status\?key=([a-f0-9]+)/i)?.[1] ??
    emailContent.match(/C[oó]digo de consulta:\s*([a-f0-9]+)/i)?.[1] ??
    "";
  expect(accessKey, "O código deve existir somente no e-mail capturado").toBeTruthy();

  return { ...body.item, accessKey };
}

export async function tentarCriarSolicitacaoPublicaDuplicadaViaApi(
  request: APIRequestContext,
  payload: DadosSolicitacaoAcessoPublica,
) {
  const response = await request.post("/api/access-requests/public", {
    data: payload,
  });

  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(409);
  validarContratoApi(
    solicitacaoAcessoDuplicadaResponseSchema,
    body,
    "POST /api/access-requests/public - 409",
  );
  expect(body?.code).toBe("DUPLICATE_ACCESS_REQUEST");
  expect(String(body?.message)).toMatch(/existe.*acesso aberta/i);

  return body;
}

