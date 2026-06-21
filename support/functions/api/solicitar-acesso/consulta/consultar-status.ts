import { expect, type APIRequestContext } from "@playwright/test";

import { validarContratoApi } from "../../contratos/validar-contrato-api";
import {
  consultarSolicitacaoAcessoResponseSchema,
  erroSolicitacaoAcessoResponseSchema,
} from "../contratos/solicitacao-acesso-response.schema";

export async function consultarSolicitacaoPorChaveAcesso(request: APIRequestContext, accessKey: string) {
  const response = await request.get(`/api/access-requests/by-key/${encodeURIComponent(accessKey)}`);
  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  validarContratoApi(
    consultarSolicitacaoAcessoResponseSchema,
    body,
    "GET /api/access-requests/by-key/:key - 200",
  );
  expect(body?.item?.id).toBeTruthy();

  return body.item;
}

export async function consultarSolicitacaoComTokenInvalido(request: APIRequestContext) {
  const response = await request.get("/api/access-requests/by-key/token-invalido-qa");
  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(404);
  validarContratoApi(
    erroSolicitacaoAcessoResponseSchema,
    body,
    "GET /api/access-requests/by-key/:key - 404",
  );
  expect(body?.message).toContain("Solicitação");

  return body;
}

export async function aprovarSolicitacaoViaApiV2(request: APIRequestContext, id: string) {
  const response = await request.post(`/api/access-requests/${id}/approve`, {
    data: {
      comment: "Aprovado após validação dos dados.",
    },
  });

  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.item?.status).toBe("approved");

  return body.item;
}

export async function recusarSolicitacaoViaApiV2(request: APIRequestContext, id: string) {
  const response = await request.post(`/api/access-requests/${id}/reject`, {
    data: {
      comment: "Recusado por dados incompatíveis.",
    },
  });

  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.item?.status).toBe("rejected");

  return body.item;
}

export async function solicitarAjusteViaApiV2(request: APIRequestContext, id: string) {
  const response = await request.post(`/api/access-requests/${id}/request-info`, {
    data: {
      comment: "Corrigir telefone e descrição antes da aprovação.",
      adjustmentFields: ["phone", "description"],
    },
  });

  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.item?.status).toBe("needs_more_info");

  return body.item;
}

