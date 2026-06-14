import { expect, type APIRequestContext } from "@playwright/test";

export async function validarSolicitacaoNaFila(
  request: APIRequestContext,
  id: string,
) {
  const response = await request.get("/api/admin/access-requests");
  const body = await response.json().catch(() => null);

  expect(response.status(), JSON.stringify(body)).toBe(200);
  expect(body?.items).toEqual(
    expect.arrayContaining([expect.objectContaining({ id })]),
  );
}
