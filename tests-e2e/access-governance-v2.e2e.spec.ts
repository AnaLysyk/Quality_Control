import { expect, test } from "@playwright/test";

import { mockAuth, type MockAuthOptions } from "./helpers/mockAuth";

type AccessRequestItem = {
  id: string;
  status: string;
};

type CreateRequestResponse = {
  item?: AccessRequestItem;
};

async function createPublicAccessRequest(
  page: import("@playwright/test").Page,
  suffix: string,
  overrides?: Record<string, unknown>,
) {
  const response = await page.request.post("/api/access-requests/public", {
    data: {
      requestType: "company_user",
      requestedRole: "company_user",
      requestedCompanySlug: "DEMO",
      requesterName: `E2E Request ${suffix}`,
      requesterEmail: `e2e-governance-${suffix}@demo.test`,
      reason: "Solicitacao E2E de governanca",
      priority: "medium",
      ...overrides,
    },
  });

  expect(response.status()).toBe(201);
  const body = (await response.json()) as CreateRequestResponse;
  expect(body.item?.id).toBeTruthy();
  return body.item?.id as string;
}

test.describe("Access governance V2", () => {
  test("menu Solicitações respeita visibilidade por perfil", async ({ page, context }) => {
    const matrix: Array<{ role: MockAuthOptions["role"]; shouldSeeRequests: boolean }> = [
      { role: "leader_tc", shouldSeeRequests: true },
      { role: "technical_support", shouldSeeRequests: true },
      { role: "testing_company_user", shouldSeeRequests: false },
      { role: "empresa", shouldSeeRequests: false },
      { role: "company_user", shouldSeeRequests: false },
    ];

    for (const row of matrix) {
      await context.clearCookies();
      await mockAuth(context, {
        role: row.role,
        companies: ["DEMO"],
        companySlug: "DEMO",
        clientSlug: "DEMO",
      });

      await page.goto("/home", { waitUntil: "domcontentloaded" });
      const requestsMenu = page.getByTestId("nav-requests");

      if (row.shouldSeeRequests) {
        await expect(requestsMenu).toBeVisible();
      } else {
        await expect(requestsMenu).toHaveCount(0);
      }
    }
  });

  test("/solicitacoes direciona para fila com foco em busca", async ({ page, context }) => {
    await mockAuth(context, {
      role: "technical_support",
      companies: ["DEMO"],
      companySlug: "DEMO",
      clientSlug: "DEMO",
    });

    await page.goto("/solicitacoes?focus=search", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/requests/);
    await expect(page.getByTestId("access-request-search-input")).toBeFocused();
  });

  test("aprovação V2: exige comentário na rejeição, permite revisar/aprovar e registra auditoria", async ({ page, context }) => {
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const requestId = await createPublicAccessRequest(page, suffix);

    await mockAuth(context, {
      role: "technical_support",
      companies: ["DEMO"],
      companySlug: "DEMO",
      clientSlug: "DEMO",
    });

    const rejectWithoutComment = await page.request.post(`/api/access-requests/${requestId}/reject`, {
      data: {},
    });
    expect(rejectWithoutComment.status()).toBe(400);

    const startReview = await page.request.post(`/api/access-requests/${requestId}/start-review`, {
      data: { comment: "Iniciando analise" },
    });
    expect(startReview.status()).toBe(200);

    const approve = await page.request.post(`/api/access-requests/${requestId}/approve`, {
      data: { comment: "Aprovado em revisao E2E" },
    });
    expect(approve.status()).toBe(200);

    const details = await page.request.get(`/api/access-requests/${requestId}`);
    expect(details.status()).toBe(200);
    const detailsBody = (await details.json()) as { item?: AccessRequestItem };
    expect(detailsBody.item?.status).toBe("approved");

    const audit = await page.request.get(`/api/access-requests/${requestId}/audit`);
    expect(audit.status()).toBe(200);
    const auditBody = (await audit.json()) as { items?: Array<{ action?: string }> };
    expect((auditBody.items ?? []).length).toBeGreaterThan(0);
    expect((auditBody.items ?? []).some((item) => item.action?.includes("access_request"))).toBeTruthy();
  });

  test("aprovação V2 bloqueia autoaprovação", async ({ page, context }) => {
    await mockAuth(context, {
      role: "technical_support",
      id: "e2e-self-approver",
      email: "self-approver@demo.test",
      companies: ["DEMO"],
      companySlug: "DEMO",
      clientSlug: "DEMO",
    });

    const created = await page.request.post("/api/access-requests", {
      data: {
        requestType: "company_user",
        requestedRole: "company_user",
        requestedCompanySlug: "DEMO",
        requesterName: "Self Approver",
        requesterEmail: "self-approver@demo.test",
        reason: "Teste E2E de autoaprovacao",
      },
    });
    expect(created.status()).toBe(201);
    const createdBody = (await created.json()) as CreateRequestResponse;
    const requestId = createdBody.item?.id as string;

    const approve = await page.request.post(`/api/access-requests/${requestId}/approve`, {
      data: { comment: "Tentativa de autoaprovar" },
    });
    expect(approve.status()).toBe(403);
    const approveBody = (await approve.json()) as { message?: string };
    expect(String(approveBody.message ?? "").toLowerCase()).toContain("autoaprova");
  });

  test("forgot/reset protege enumeração e rejeita tokens inválidos", async ({ page }) => {
    const existing = await page.request.post("/api/auth/forgot-password", {
      data: { email: "admin@demo.test" },
    });
    const unknown = await page.request.post("/api/auth/forgot-password", {
      data: { email: "nao-existe-e2e@demo.test" },
    });

    expect(existing.status()).toBe(200);
    expect(unknown.status()).toBe(200);

    const existingBody = (await existing.json()) as { message?: string };
    const unknownBody = (await unknown.json()) as { message?: string };
    expect(existingBody.message).toBeTruthy();
    expect(existingBody.message).toBe(unknownBody.message);

    const validateInvalid = await page.request.post("/api/auth/reset-password/validate", {
      data: { token: "token-invalido-e2e" },
    });
    expect(validateInvalid.status()).toBe(200);
    const validateBody = (await validateInvalid.json()) as { valid?: boolean };
    expect(validateBody.valid).toBeFalsy();

    const confirmInvalid = await page.request.post("/api/auth/reset-password/confirm", {
      data: { token: "token-invalido-e2e", newPassword: "NovaSenha@2026!" },
    });
    expect(confirmInvalid.status()).toBe(400);
  });
});
