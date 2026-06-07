import { expect, type APIRequestContext } from "@playwright/test";

import {
  accessRequestAdjustment,
  accessRequestReject,
  buildAccessRequestPayload,
} from "./access-requests.data";

type CreatedAccessRequest = {
  id: string;
  email: string;
  payload: ReturnType<typeof buildAccessRequestPayload>;
};

function adminHeaders() {
  return {
    "x-test-admin": "true",
    "x-test-role": "leader_tc",
  };
}

function getRequestId(body: unknown): string {
  const source = body as Record<string, unknown>;

  const request = source.request as Record<string, unknown> | undefined;
  const item = source.item as Record<string, unknown> | undefined;
  const data = source.data as Record<string, unknown> | undefined;

  const candidates = [
    source.id,
    source.requestId,
    source.accessRequestId,
    source.key,
    request?.id,
    item?.id,
    data?.id,
    data?.requestId,
  ];

  const value = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());

  expect(value, `Resposta não retornou id/key da solicitação: ${JSON.stringify(body)}`).toBeTruthy();

  return String(value);
}

export async function validarApiSolicitacoesAcessivel(request: APIRequestContext) {
  const response = await request.get("/api/admin/access-requests", {
    headers: adminHeaders(),
  });

  expect(response.status()).not.toBe(500);
  expect([200, 401, 403]).toContain(response.status());
}

export async function validarApiSolicitacoesNaoQuebra(request: APIRequestContext) {
  const response = await request.get("/api/admin/access-requests", {
    headers: adminHeaders(),
  });

  expect(response.status()).not.toBe(500);
}

export async function criarSolicitacaoDeAcessoViaApi(
  request: APIRequestContext,
  suffix = Date.now(),
): Promise<CreatedAccessRequest> {
  const payload = buildAccessRequestPayload(suffix);

  const response = await request.post("/api/support/access-request", {
    data: payload,
  });

  const text = await response.text();

  expect(response.status(), text).toBeLessThan(500);
  expect(response.ok(), text).toBeTruthy();

  const body = JSON.parse(text);
  const id = getRequestId(body);

  return {
    id,
    email: payload.email,
    payload,
  };
}

export async function solicitarAjusteSolicitacaoViaApi(
  request: APIRequestContext,
  id: string,
) {
  const response = await request.post(`/api/admin/access-requests/${id}/request-adjustment`, {
    headers: adminHeaders(),
    data: accessRequestAdjustment,
  });

  const text = await response.text();

  expect(response.status(), text).toBeLessThan(500);
  expect(response.ok(), text).toBeTruthy();

  expect(text).toMatch(/in_progress|ok|true/i);
}

export async function rejeitarSolicitacaoViaApi(
  request: APIRequestContext,
  id: string,
) {
  const response = await request.post(`/api/admin/access-requests/${id}/reject`, {
    headers: adminHeaders(),
    data: accessRequestReject,
  });

  const text = await response.text();

  expect(response.status(), text).toBeLessThan(500);
  expect(response.ok(), text).toBeTruthy();

  expect(text).toMatch(/rejected|ok|true/i);
}

export async function aprovarSolicitacaoViaApi(
  request: APIRequestContext,
  created: CreatedAccessRequest,
) {
  const response = await request.post(`/api/admin/access-requests/${created.id}/accept`, {
    headers: adminHeaders(),
    data: {
      email: created.payload.email,
      name: created.payload.full_name,
      comment: "Aprovado pelo teste automatizado.",
      admin_notes: "Aprovado pelo teste automatizado.",
      access_type: "technical_support",
    },
  });

  const text = await response.text();

  expect(response.status(), text).toBeLessThan(500);
  expect(response.ok(), text).toBeTruthy();

  expect(text).toMatch(/closed|approved|ok|true/i);
}

