import { test, expect } from "../../../fixtures/test";
import {
  autenticarUsuario,
  configurarUsuarioSimulado,
} from "../../ui/apoio/autenticar-usuario-teste";

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
      full_name: name,
      email,
      role,
      company,
      company_name: company,
      phone: "(11) 99999-9999",
      password: "Griaule@123",
      title: `Solicitação ${name}`,
      description: notes ?? "Solicitação criada pelo E2E.",
      access_type: accessType,
      profile_type: accessType === "company" ? "empresa" : "company_user",
      notes,
    },
  });
  expect(res.ok()).toBeTruthy();
}

test.setTimeout(180000);

test("admin abre e aceita/rejeita solicitaÃ§Ãµes de acesso", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const acceptEmail = `e2e.accept.${suffix}@demo.test`;
  const rejectEmail = `e2e.reject.${suffix}@demo.test`;

  await createAccessRequest(page, {
    name: `User Accept ${suffix}`,
    email: acceptEmail,
    role: "QA Lead",
    company: "DEMO",
    accessType: "company",
    notes: "SolicitaÃ§Ã£o para administrar a empresa.",
  });

  await createAccessRequest(page, {
    name: `User Reject ${suffix}`,
    email: rejectEmail,
    role: "QA",
    company: "DEMO",
    accessType: "user",
    notes: "SolicitaÃ§Ã£o para acesso bÃ¡sico.",
  });

  await configurarUsuarioSimulado(page, "admin");
  await autenticarUsuario(page, "admin@example.com", "senha");
  await page.goto("/admin/access-requests", { waitUntil: "domcontentloaded" });

  const acceptRow = page.getByRole("button").filter({ hasText: acceptEmail }).first();
  await expect(acceptRow).toBeVisible({ timeout: 20000 });
  await acceptRow.click();
  await expect(page.getByLabel(/^Email$/i)).toHaveValue(acceptEmail);
  await page.getByLabel(/^Empresa$/i).selectOption({ label: "DEMO" });
  await expect(page.getByRole("button", { name: /Aceitar solicita/ })).toBeEnabled();

  await page.getByRole("button", { name: /Aprovar solicita/i }).click();
  await expect(acceptRow).toContainText(/Aprovada/i, { timeout: 20000 });

  const rejectRow = page.getByRole("button").filter({ hasText: rejectEmail }).first();
  await expect(rejectRow).toBeVisible({ timeout: 20000 });
  await rejectRow.click();
  await expect(page.getByLabel(/^Email$/i)).toHaveValue(rejectEmail);
  await page.getByLabel(/Notas do admin/i).fill("SolicitaÃ§Ã£o rejeitada.");

  await expect(page.getByRole("button", { name: /Recusar solicita/i })).toBeEnabled();
  await page.getByRole("button", { name: /Recusar solicita/i }).click();
  await expect(rejectRow).toContainText(/Rejeitada/i, { timeout: 20000 });
});

