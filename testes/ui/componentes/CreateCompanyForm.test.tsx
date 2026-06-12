/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import CreateCompanyForm from "@/components/CreateCompanyForm";

const originalFetch = globalThis.fetch;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

describe("CreateCompanyForm", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = originalFetch;
  });

  it("usa apenas a resposta mais recente da BrasilAPI e ignora retorno antigo", async () => {
    const firstLookup = createDeferred<Response>();
    const secondLookup = createDeferred<Response>();
    const fetchSpy = jest
      .fn()
      .mockImplementationOnce(() => firstLookup.promise)
      .mockImplementationOnce(() => secondLookup.promise);
    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = fetchSpy as typeof fetch;

    render(<CreateCompanyForm />);

    const cnpjInput = screen.getByPlaceholderText("CNPJ (opcional para preenchimento automático)");
    const nameInput = screen.getByPlaceholderText("Nome da empresa");

    fireEvent.change(cnpjInput, { target: { value: "11.111.111/1111-11" } });
    expect(cnpjInput).toHaveValue("11111111111111");
    fireEvent.blur(cnpjInput);

    fireEvent.change(cnpjInput, { target: { value: "22.222.222/2222-22" } });
    expect(cnpjInput).toHaveValue("22222222222222");
    fireEvent.blur(cnpjInput);

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondLookup.resolve(createJsonResponse({ nome_fantasia: "Empresa Nova" }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(nameInput).toHaveValue("Empresa Nova");
    });

    await act(async () => {
      firstLookup.resolve(createJsonResponse({ nome_fantasia: "Empresa Antiga" }));
      await Promise.resolve();
    });

    expect(nameInput).toHaveValue("Empresa Nova");
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "/api/brasilapi/cnpj/11111111111111",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "/api/brasilapi/cnpj/22222222222222",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("nao sobrescreve um nome digitado enquanto a consulta esta em andamento", async () => {
    const lookup = createDeferred<Response>();
    const fetchSpy = jest.fn().mockImplementation(() => lookup.promise);
    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = fetchSpy as typeof fetch;

    render(<CreateCompanyForm />);

    const cnpjInput = screen.getByPlaceholderText("CNPJ (opcional para preenchimento automático)");
    const nameInput = screen.getByPlaceholderText("Nome da empresa");

    fireEvent.change(cnpjInput, { target: { value: "19131243000197" } });
    fireEvent.blur(cnpjInput);

    fireEvent.change(nameInput, { target: { value: "Nome manual" } });
    expect(nameInput).toHaveValue("Nome manual");

    await act(async () => {
      lookup.resolve(
        createJsonResponse({
          nome_fantasia: "REDE PELO CONHECIMENTO LIVRE",
          razao_social: "OPEN KNOWLEDGE BRASIL",
        }),
      );
      await Promise.resolve();
    });

    expect(nameInput).toHaveValue("Nome manual");
  });
});
