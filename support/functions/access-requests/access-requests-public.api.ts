import { expect, type APIRequestContext } from "@playwright/test";

import { esperarEmailCapturado } from "./access-requests.email";

export type PublicAccessRequestPayload = {
  requestType: string;
  requestedRole: string;
  requesterName: string;
  requesterEmail: string;
  email: string;
  full_name: string;
  name: string;
  user: string;
  phone: string;
  role: string;
  profile_type: string;
  title: string;
  description: string;
  password: string;
  reason: string;
  priority: string;
};

export function buildPublicAccessRequestPayload(email: string): PublicAccessRequestPayload {
  const suffix = Date.now();

  return {
    requestType: "technical_support",
    requestedRole: "technical_support",
    requesterName: `Solicitante E2E ${suffix}`,
    requesterEmail: email,
    email,
    full_name: `Solicitante E2E ${suffix}`,
    name: `Solicitante E2E ${suffix}`,
    user: `qa.e2e.${suffix}`,
    phone: "51999999999",
    role: "Analista de QA",
    profile_type: "technical_support",
    title: "Solicitação de acesso automatizada",
    description: "Solicitação criada pelo teste automatizado para validar o ciclo de e-mail.",
    password: "Temp@123456",
    reason: "Solicitação criada pelo teste automatizado para validar o ciclo de e-mail.",
    priority: "medium",
  };
}

export async function criarSolicitacaoPublicaViaApi(
  request: APIRequestContext,
  payload: PublicAccessRequestPayload,
) {
  const response = await request.post("/api/access-requests/public", {
    data: payload,
  });

  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(201);
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
  payload: PublicAccessRequestPayload,
) {
  const response = await request.post("/api/access-requests/public", {
    data: payload,
  });

  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(409);
  expect(body?.code).toBe("DUPLICATE_ACCESS_REQUEST");
  expect(String(body?.message)).toMatch(/existe.*acesso aberta/i);

  return body;
}

