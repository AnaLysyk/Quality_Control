/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RequireClient } from "@/components/RequireClient";

const replaceMock = jest.fn();
const refreshUserMock = jest.fn();
let authState: {
  user: unknown;
  companies: unknown[];
  loading: boolean;
  error: string | null;
  refreshUser: jest.Mock;
  logout: jest.Mock;
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/empresas/griaule/runs",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/hooks/useAuthUser", () => ({
  useAuthUser: () => authState,
}));

describe("RequireClient", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    refreshUserMock.mockClear();
    authState = {
      user: null,
      companies: [],
      loading: false,
      error: null,
      refreshUser: refreshUserMock,
      logout: jest.fn(),
    };
  });

  it("mostra o estado de validacao enquanto a sessao carrega", () => {
    authState.loading = true;

    render(
      <RequireClient slug="griaule">
        <div>conteudo protegido</div>
      </RequireClient>,
    );

    expect(screen.getByText("Validando acesso da empresa")).toBeInTheDocument();
    expect(screen.queryByText("conteudo protegido")).not.toBeInTheDocument();
  });

  it("libera o conteudo quando o usuario tem acesso normalizado", () => {
    authState.user = {
      id: "user-1",
      clientSlug: "GRIAULE",
    };

    render(
      <RequireClient slug="griaule">
        <div>conteudo protegido</div>
      </RequireClient>,
    );

    expect(screen.getByText("conteudo protegido")).toBeInTheDocument();
    expect(screen.queryByText("Acesso negado")).not.toBeInTheDocument();
  });

  it("libera o conteudo quando o payload legado vem com companySlug", () => {
    authState.user = {
      id: "user-legacy-company-slug",
      companySlug: "GRIAULE",
    };

    render(
      <RequireClient slug="griaule">
        <div>conteudo protegido</div>
      </RequireClient>,
    );

    expect(screen.getByText("conteudo protegido")).toBeInTheDocument();
  });

  it("libera o conteudo para suporte tecnico sem vinculo direto", () => {
    authState.user = {
      id: "user-support",
      permissionRole: "technical_support",
    };

    render(
      <RequireClient slug="griaule">
        <div>conteudo protegido</div>
      </RequireClient>,
    );

    expect(screen.getByText("conteudo protegido")).toBeInTheDocument();
  });

  it("mostra acesso negado quando o usuario nao possui vinculo com a empresa", () => {
    authState.user = {
      id: "user-2",
      clientSlug: "outra-empresa",
    };

    render(
      <RequireClient slug="griaule">
        <div>conteudo protegido</div>
      </RequireClient>,
    );

    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir minha empresa" })).toHaveAttribute("href", "/empresas/outra-empresa/home");
  });

  it("mostra erro tratado e permite nova tentativa", () => {
    authState.error = "Tempo esgotado ao validar a sessao";

    render(
      <RequireClient slug="griaule">
        <div>conteudo protegido</div>
      </RequireClient>,
    );

    expect(screen.getByText("Nao foi possivel validar a sessao")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refreshUserMock).toHaveBeenCalledWith(true);
  });

  it("mostra estado tratado quando o slug da rota nao existe", () => {
    authState.user = {
      id: "user-3",
      companySlug: "griaule",
    };

    render(
      <RequireClient>
        <div>conteudo protegido</div>
      </RequireClient>,
    );

    expect(screen.getByText("Empresa nao encontrada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para empresas" })).toHaveAttribute("href", "/empresas");
  });

  it("redireciona para login quando nao existe usuario autenticado", async () => {
    render(
      <RequireClient slug="griaule">
        <div>conteudo protegido</div>
      </RequireClient>,
    );

    expect(screen.getByText("Sessao expirada")).toBeInTheDocument();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fempresas%2Fgriaule%2Fruns");
    });
  });
});
