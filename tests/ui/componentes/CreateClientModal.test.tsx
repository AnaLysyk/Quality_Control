/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

import { CreateClientModal } from "../../../app/clients/components/CreateClientModal";

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

describe("CreateClientModal", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = originalFetch;
  });

  it("preenche o nome da empresa a partir do CNPJ usando a BrasilAPI", async () => {
    const fetchSpy = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/public/company-lookup/cnpj")) {
        return Promise.resolve(
          createJsonResponse({
            ok: true,
            item: {
              cnpj: "77042130000111",
              fantasyName: "Testing Company",
              companyName: "Testing Company LTDA",
            },
          }),
        );
      }

      return Promise.resolve(createJsonResponse({}));
    });
    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = fetchSpy as typeof fetch;

    render(<CreateClientModal open={true} onClose={jest.fn()} onCreate={jest.fn()} />);

    const taxIdInput = screen.getByLabelText("CNPJ") as HTMLInputElement;
    const nameInput = screen.getByLabelText("Nome / razão social") as HTMLInputElement;

    fireEvent.change(taxIdInput, { target: { value: "77.042.130/0001-11" } });
    expect(taxIdInput).toHaveValue("77042130000111");
    fireEvent.blur(taxIdInput);

    await waitFor(() => {
      expect(nameInput).toHaveValue("Testing Company");
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/public/company-lookup/cnpj?cnpj=77042130000111",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("nao sobrescreve um nome digitado manualmente enquanto a consulta esta em andamento", async () => {
    const lookup = createDeferred<Response>();
    const fetchSpy = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/public/company-lookup/cnpj")) {
        return lookup.promise;
      }

      return Promise.resolve(createJsonResponse({}));
    });
    (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch = fetchSpy as typeof fetch;

    render(<CreateClientModal open={true} onClose={jest.fn()} onCreate={jest.fn()} />);

    const taxIdInput = screen.getByLabelText("CNPJ") as HTMLInputElement;
    const nameInput = screen.getByLabelText("Nome / razão social") as HTMLInputElement;

    fireEvent.change(taxIdInput, { target: { value: "77042130000111" } });
    fireEvent.blur(taxIdInput);

    fireEvent.change(nameInput, { target: { value: "Nome manual" } });
    expect(nameInput).toHaveValue("Nome manual");

    await act(async () => {
      lookup.resolve(
        createJsonResponse({
          ok: true,
          item: {
            cnpj: "77042130000111",
            fantasyName: "Testing Company",
            companyName: "Testing Company LTDA",
          },
        }),
      );
      await Promise.resolve();
    });

    expect(nameInput).toHaveValue("Nome manual");
  });
});

