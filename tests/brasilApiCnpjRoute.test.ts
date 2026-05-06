/** @jest-environment node */

import { NextRequest } from "next/server";

import { GET } from "../app/api/brasilapi/cnpj/[cnpj]/route";

const originalFetch = globalThis.fetch;

describe("GET /api/brasilapi/cnpj/[cnpj]", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = originalFetch;
  });

  it("normaliza o CNPJ e retorna o nome da empresa", async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        nome_fantasia: "Testing Company",
        razao_social: "Testing Company LTDA",
      }),
    });
    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = fetchSpy as typeof fetch;

    const response = await GET(new NextRequest("http://localhost/api/brasilapi/cnpj/19131243000197"), {
      params: Promise.resolve({ cnpj: "19.131.243/0001-97" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      cnpj: "19131243000197",
      company_name: "Testing Company",
      nome_fantasia: "Testing Company",
      razao_social: "Testing Company LTDA",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://brasilapi.com.br/api/cnpj/v1/19131243000197",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("rejeita CNPJ invalido", async () => {
    const response = await GET(new NextRequest("http://localhost/api/brasilapi/cnpj/123"), {
      params: Promise.resolve({ cnpj: "123" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "CNPJ invalido" });
  });
});
