import { expect, test } from "@playwright/test";

const REAL_EMAIL = "ana.testing.company@gmail.com";
const PASSWORD = "TESTE123456";
const ADMIN_LOGIN = "admin";
const ADMIN_PASSWORD = "Demo@123";

const profiles = [
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

function buildUniqueEmail(profileValue: string, unique: number) {
  const [user, domain] = REAL_EMAIL.split("@");
  return `${user}+approval.${profileValue}.${unique}@${domain}`;
}

async function createPublicAccessRequest(
  page: import("@playwright/test").Page,
  profile: (typeof profiles)[number],
) {
  const unique = Date.now();
  const email = buildUniqueEmail(profile.value, unique);
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

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const response = await page.request.post("/api/auth/login", {
    data: {
      login: ADMIN_LOGIN,
      password: ADMIN_PASSWORD,
    },
  });

  const text = await response.text();
  expect(response.ok(), text).toBeTruthy();
}

async function approveAccessRequest(
  page: import("@playwright/test").Page,
  requestId: string,
  createdRequest: {
    email: string;
    fullName: string;
    title: string;
    description: string;
    role: string;
    phone: string;
  },
  profile: (typeof profiles)[number],
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
      comment: "Aprovado pelo teste automatizado.",
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

async function loginAsCreatedUser(
  page: import("@playwright/test").Page,
  username: string,
  profile: (typeof profiles)[number],
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

async function readMe(page: import("@playwright/test").Page) {
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

test.describe("Solicitação pública de acesso - aprovação, login e perfil", () => {
  test.setTimeout(120_000);

  for (const profile of profiles) {
    test(`deve aprovar, logar e validar perfil para ${profile.label}`, async ({ page }) => {
      const createdRequest = await createPublicAccessRequest(page, profile);

      await loginAsAdmin(page);

      const username = await approveAccessRequest(page, createdRequest.requestId, createdRequest, profile);

      await loginAsCreatedUser(page, username, profile);

      const me = await readMe(page);

      expect(me.user?.email).toBe(createdRequest.email);
      expect(me.user?.name).toBe(createdRequest.fullName);
      expect(me.user?.username).toBe(username);

      expect(me.user?.role).toBe(profile.expectedRole);
      expect(me.user?.isGlobalAdmin).toBe(profile.expectedGlobalAdmin);

      expect(me.user?.phone).toBe("55555555555");
      expect(me.user?.jobTitle ?? me.user?.job_title).toBe("Analista de QA");

      if (profile.needsCompany) {
        expect(me.companies?.some((company) => company.id === "cmp_e2e_testing_company")).toBeTruthy();
        if (profile.expectsPrimaryClient) {
          expect(me.user?.clientId).toBe("cmp_e2e_testing_company");
        }
      } else {
        expect(me.user?.clientId).toBeFalsy();
      }

    });
  }
});
