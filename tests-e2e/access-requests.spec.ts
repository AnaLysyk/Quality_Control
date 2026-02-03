import { test, expect } from "./fixtures/test";
import { login, setMockUser } from "./utils/auth";

type AccessType = "user" | "company";

async function createAccessRequest(
  page: import("@playwright/test").Page,
  {
    name,
    email,
    role,
    company,
    accessType,
    notes,
  }: {
    name: string;
    email: string;
    role: string;
    company: string;
    accessType: AccessType;
    notes?: string;
  }
) {
  const res = await page.request.post("/api/support/access-request", {
    data: {
      name,
      email,
      role,
      company,
      access_type: accessType,
      notes,
    },
  });
  expect(res.ok()).toBeTruthy();
}

test.setTimeout(180000);

test("admin abre e aceita/rejeita solicitações de acesso", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const acceptEmail = `e2e.accept.${suffix}@griaule.test`;
  const rejectEmail = `e2e.reject.${suffix}@griaule.test`;

  await createAccessRequest(page, {
    name: `User Accept ${suffix}`,
    email: acceptEmail,
    role: "QA Lead",
    company: "Griaule",
    accessType: "company",
    notes: "Solicitação para administrar a empresa.",
  });

  await createAccessRequest(page, {
    name: `User Reject ${suffix}`,
    email: rejectEmail,
    role: "QA",
    company: "Griaule",
    accessType: "user",
    notes: "Solicitação para acesso básico.",
  });

  await setMockUser(page, "admin");
  await login(page, "admin@example.com", "senha");
  await page.goto("/admin/access-requests", { waitUntil: "domcontentloaded" });

  const acceptRow = page.getByRole("button").filter({ hasText: acceptEmail }).first();
  await expect(acceptRow).toBeVisible({ timeout: 20000 });
  await acceptRow.click();
  await expect(page.getByLabel(/^Email$/i)).toHaveValue(acceptEmail);
  await page.getByLabel(/^Empresa$/i).selectOption({ label: "Griaule" });
  await expect(page.getByRole("button", { name: /Aceitar solicita/ })).toBeEnabled();

  const acceptResponse = page.waitForResponse(
    (response) => response.url().includes("/api/admin/access-requests/") && response.url().endsWith("/accept")
  );
  await page.getByRole("button", { name: /Aceitar solicita/ }).click();
  await acceptResponse;
  await expect(acceptRow).toContainText(/Aprovada/i);

  const rejectRow = page.getByRole("button").filter({ hasText: rejectEmail }).first();
  await expect(rejectRow).toBeVisible({ timeout: 20000 });
  await rejectRow.click();
  await expect(page.getByLabel(/^Email$/i)).toHaveValue(rejectEmail);
  await page.getByLabel(/Notas do admin/i).fill("Solicitação rejeitada.");

  const rejectResponse = page.waitForResponse(
    (response) => response.url().includes("/api/admin/access-requests/") && response.url().endsWith("/reject")
  );
  await page.getByRole("button", { name: /Recusar solicita/ }).click();
  await rejectResponse;
  await expect(rejectRow).toContainText(/Rejeitada/i);
});
