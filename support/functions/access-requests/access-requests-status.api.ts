import { expect, type APIRequestContext } from "@playwright/test";

export function reviewerAuthHeaders() {
  const payload = Buffer.from(
    JSON.stringify({
      id: "e2e-reviewer-leader-tc",
      email: "leader.tc.e2e@testingcompany.local",
      role: "leader_tc",
      permissionRole: "leader_tc",
      companyRole: "leader_tc",
      isGlobalAdmin: true,
    }),
  ).toString("base64url");

  return {
    cookie: `e2e_auth=${encodeURIComponent(payload)}`,
  };
}

export async function consultarSolicitacaoPorAccessKey(request: APIRequestContext, accessKey: string) {
  const response = await request.get(`/api/access-requests/by-key/${encodeURIComponent(accessKey)}`);
  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.item?.id).toBeTruthy();

  return body.item;
}

export async function consultarSolicitacaoComTokenInvalido(request: APIRequestContext) {
  const response = await request.get("/api/access-requests/by-key/token-invalido-qa");
  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(404);
  expect(body?.message).toContain("Solicitação");

  return body;
}

export async function aprovarSolicitacaoViaApiV2(request: APIRequestContext, id: string) {
  const response = await request.post(`/api/access-requests/${id}/approve`, {
    headers: reviewerAuthHeaders(),
    data: {
      comment: "Aprovado pelo teste automatizado.",
    },
  });

  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.item?.status).toBe("approved");

  return body.item;
}

export async function recusarSolicitacaoViaApiV2(request: APIRequestContext, id: string) {
  const response = await request.post(`/api/access-requests/${id}/reject`, {
    headers: reviewerAuthHeaders(),
    data: {
      comment: "Recusado pelo teste automatizado.",
    },
  });

  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.item?.status).toBe("rejected");

  return body.item;
}

export async function solicitarAjusteViaApiV2(request: APIRequestContext, id: string) {
  const response = await request.post(`/api/access-requests/${id}/request-info`, {
    headers: reviewerAuthHeaders(),
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
