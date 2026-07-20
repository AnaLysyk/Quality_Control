/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/backend/auth/pageAccessGuard", () => ({
  requireScreenAccess: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/brain/_components/BrainAccessRequestFlowPanel", () => ({
  BrainAccessRequestFlowPanel: () => <div>brain flow</div>,
}));

jest.mock("@/empresas/[slug]/integracoes/CompanyIntegrationsClient", () => ({
  __esModule: true,
  default: ({ companySlug, provider }: { companySlug: string; provider: string }) => (
    <div>{provider}:{companySlug}</div>
  ),
}));

import { requireScreenAccess } from "@/backend/auth/pageAccessGuard";
import BrainLayout from "@/brain/layout";
import CasosDeTesteLayout from "@/casos-de-teste/layout";
import ChatLayout from "@/chat/layout";
import PlanosDeTesteLayout from "@/planos-de-teste/layout";
import UsuariosVinculosLayout from "@/usuarios/vinculos/layout";
import CompanyJiraIntegrationPage from "@/empresas/[slug]/integracoes/jira/page";
import CompanyQaseIntegrationPage from "@/empresas/[slug]/integracoes/qase/page";

const mockedRequireScreenAccess = requireScreenAccess as jest.MockedFunction<typeof requireScreenAccess>;

describe("Sonar readonly layouts and integration pages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [BrainLayout, "brain", "view", "/brain"],
    [CasosDeTesteLayout, "test_repository", "read", "/casos-de-teste"],
    [ChatLayout, "chat", "view", "/chat"],
    [PlanosDeTesteLayout, "test_plan", "read", "/planos-de-teste"],
    [UsuariosVinculosLayout, "relationships", "view", "/usuarios/vinculos"],
  ])("protege e renderiza o layout", async (Layout, moduleId, action, loginNext) => {
    const element = await Layout({ children: <div>conteúdo protegido</div> });
    render(element);

    expect(mockedRequireScreenAccess).toHaveBeenCalledWith(moduleId, action, { loginNext });
    expect(screen.getByText("conteúdo protegido")).toBeInTheDocument();
  });

  it("renderiza página Jira com slug resolvido", async () => {
    render(await CompanyJiraIntegrationPage({ params: Promise.resolve({ slug: "empresa-a" }) }));
    expect(screen.getByText("jira:empresa-a")).toBeInTheDocument();
  });

  it("renderiza página Qase com slug resolvido", async () => {
    render(await CompanyQaseIntegrationPage({ params: Promise.resolve({ slug: "empresa-b" }) }));
    expect(screen.getByText("qase:empresa-b")).toBeInTheDocument();
  });
});
