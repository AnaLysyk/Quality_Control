import { expect, type Page } from "@playwright/test";

const PASSWORD = process.env.E2E_PROFILE_PASSWORD ?? "";

export type PerfilAprovacaoSolicitacao = {
  label: string;
  value: string;
  expectedRole: string;
  needsCompany: boolean;
  expectsPrimaryClient: boolean;
  expectedGlobalAdmin: boolean;
};

export const perfisAprovacaoSolicitacao: PerfilAprovacaoSolicitacao[] = [
  {
    label: "Usuário da empresa",
    value: "company_user",
    expectedRole: "company_user",
    needsCompany: true,
    expectsPrimaryClient: true,
    expectedGlobalAdmin: false,
  },
  {
    label: "Usuário TC",
    value: "testing_company_user",
    expectedRole: "testing_company_user",
    needsCompany: true,
    expectsPrimaryClient: false,
    expectedGlobalAdmin: false,
  },
  {
    label: "Líder TC",
    value: "leader_tc",
    expectedRole: "leader_tc",
    needsCompany: false,
    expectsPrimaryClient: false,
    expectedGlobalAdmin: true,
  },
  {
    label: "Suporte Técnico",
    value: "technical_support",
    expectedRole: "technical_support",
    needsCompany: false,
    expectsPrimaryClient: false,
    expectedGlobalAdmin: false,
  },
];

export type SolicitacaoCriadaParaAprovacao = {
  requestId: string;
  email: string;
  fullName: string;
  title: string;
  description: string;
  role: string;
  phone: string;
};

export function criarEmailUnicoAprovacao(profileValue: string, unique: number) {
  return `approval.${profileValue}.${unique}@quality-control.test`;
}

export async function criarSolicitacaoPublicaParaAprovacao(
  page: Page,
  profile: PerfilAprovacaoSolicitacao,
): Promise<SolicitacaoCriadaParaAprovacao> {
  const unique = Date.now();
  const email = criarEmailUnicoAprovacao(profile.value, unique);
  const fullName = `Teste Aprovacao ${profile.label} ${unique}`;
  const title = `Aprovação real - ${profile.label}`;
  const description = `Teste de aprovação, login e perfil para ${profile.label}.`;

  const response = await page.request.post("/api/access-requests/public", {
    data: {
      requestType: profile.value,
      requestedRole: profile.value,
      requestedCompanyId: profile.needsCompany ? "cmp_e2e_testing_company" : undefined,
      requestedCompanySlug: profile.needsCompany ? "Testing Company E2E" : undefined,

      requesterName: fullName,
      requesterEmail: email,

      full_name: fullName,
      name: fullName,
      user: profile.value === "technical_support" ? email : undefined,
      email,
      phone: "55555555555",
      company: profile.needsCompany ? "Testing Company E2E" : undefined,
      client_id: profile.needsCompany ? "cmp_e2e_testing_company" : undefined,
      role: "Analista de QA",
      profile_type: profile.value,
      title,
      description,
      reason: description,
      password: PASSWORD,
      priority: "medium",
    },
  });

  const text = await response.text();

  expect(response.status(), text).toBe(201);

  const json = JSON.parse(text) as {
    ok?: boolean;
    item?: {
      id?: string;
      requesterEmail?: string;
      requestType?: string;
      requestedCompanyId?: string;
    };
  };

  expect(json.ok).toBeTruthy();
  expect(json.item?.id).toBeTruthy();
  expect(json.item?.requesterEmail).toBe(email);
  expect(json.item?.requestType).toBe(profile.value);

  if (profile.expectsPrimaryClient) {
    expect(json.item?.requestedCompanyId).toBe("cmp_e2e_testing_company");
  } else if (profile.value === "testing_company_user") {
    expect(json.item?.requestedCompanyId).toBeUndefined();
  }

  return {
    requestId: json.item!.id!,
    email,
    fullName,
    title,
    description,
    role: "Analista de QA",
    phone: "55555555555",
  };
}

export async function loginComoRevisorSolicitacao(page: Page) {
  const response = await page.request.post("/api/auth/login", {
    data: {
      user: "e2e-leader-tc@testingcompany.local",
      password: PASSWORD,
    },
  });

  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
}

export async function aprovarSolicitacaoDeAcesso(
  page: Page,
  requestId: string,
  createdRequest: SolicitacaoCriadaParaAprovacao,
  profile: PerfilAprovacaoSolicitacao,
) {
  const prepareResponse = await page.request.patch(`/api/admin/access-requests/${requestId}`, {
    data: {
      email: createdRequest.email,
      name: createdRequest.fullName,
      full_name: createdRequest.fullName,
      user: createdRequest.email,
      phone: createdRequest.phone,
      role: createdRequest.role,
      company: profile.needsCompany ? "Testing Company E2E" : undefined,
      client_id: profile.needsCompany ? "cmp_e2e_testing_company" : undefined,
      access_type: profile.value,
      title: createdRequest.title,
      description: createdRequest.description,
      password: PASSWORD,
    },
  });

  const prepareText = await prepareResponse.text();
  expect(prepareResponse.ok(), prepareText).toBeTruthy();

  const response = await page.request.post(`/api/admin/access-requests/${requestId}/accept`, {
    data: {
      comment: "Aprovado após validação dos dados.",
    },
  });

  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();

  const json = JSON.parse(text) as {
    ok?: boolean;
    item?: {
      id?: string;
      status?: string;
      username?: string;
    };
  };

  expect(json.ok).toBeTruthy();
  expect(json.item?.id).toBe(requestId);
  expect(json.item?.status).toBe("closed");
  expect(json.item?.username).toBeTruthy();

  return json.item!.username!;
}

export async function loginComoUsuarioCriado(
  page: Page,
  username: string,
  profile: PerfilAprovacaoSolicitacao,
) {
  await page.context().clearCookies();

  const response = await page.request.post("/api/auth/login", {
    data: {
      login: username,
      password: PASSWORD,
      companySlug: profile.needsCompany ? "testing-company-e2e" : undefined,
    },
  });

  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
}

export async function lerUsuarioAtual(page: Page) {
  const response = await page.request.get("/api/me");
  const text = await response.text();

  expect(response.ok(), text).toBeTruthy();

  return JSON.parse(text) as {
    user?: {
      email?: string;
      name?: string;
      username?: string;
      phone?: string | null;
      jobTitle?: string | null;
      job_title?: string | null;
      role?: string | null;
      globalRole?: string | null;
      companyRole?: string | null;
      clientId?: string | null;
      clientSlug?: string | null;
      isGlobalAdmin?: boolean;
      userOrigin?: string | null;
      user_origin?: string | null;
    };
    companies?: Array<{
      id?: string;
      name?: string;
      slug?: string;
      companyRole?: string | null;
    }>;
  };
}

export async function lerUsuarioCriadoNoAdmin(
  page: Page,
  email: string,
) {
  const response = await page.request.get("/api/admin/users");
  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();

  const body = JSON.parse(text) as {
    items?: Array<{
      name?: string;
      email?: string;
      user?: string;
      role?: string;
      permission_role?: string;
      client_id?: string | null;
      company_names?: string[];
      phone?: string | null;
      job_title?: string | null;
    }>;
  };

  const item = body.items?.find((candidate) => candidate.email === email);

  expect(item, `Usuário ${email} não encontrado no cadastro administrativo`).toBeTruthy();

  return item!;
}

export async function validarPaginaPerfilUsuarioCriado(
  page: Page,
  expected: {
    fullName: string;
    username: string;
    email: string;
    phone: string;
    jobTitle: string;
  },
) {
  await page.goto("/settings/profile", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("profile-full-name-input")).toHaveValue(expected.fullName);
  await expect(page.getByTestId("profile-username-input")).toHaveValue(expected.username);
  await expect(page.getByTestId("profile-email-input")).toHaveValue(expected.email);
  await expect(page.getByTestId("profile-phone-input")).toHaveValue(expected.phone);
  await expect(page.getByTestId("profile-job-title-input")).toHaveValue(expected.jobTitle);
}
