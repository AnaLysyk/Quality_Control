/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/email/enviar-email-real.manual.ui.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";
import {
  abrirFormularioSolicitacaoPublica,
  selecionarCargoAnalista,
} from "../../../../../support/functions/ui/login/solicitar-acesso/compartilhado/preencher-formulario-publico";
import {
  criarEmailRealUnico,
  perfisEmailRealSolicitacao,
} from "../../../../../support/functions/ui/login/solicitar-acesso/compartilhado/preparar-email-real";

const REAL_EMAIL = process.env.E2E_REAL_EMAIL_TARGET ?? "";
const PASSWORD = process.env.E2E_PROFILE_PASSWORD ?? "";

test.describe("Solicitação pública de acesso com envio real de e-mail", () => {
  test.skip(
    process.env.E2E_SEND_REAL_EMAIL !== "true" || !REAL_EMAIL,
    "Cenário protegido: configure E2E_SEND_REAL_EMAIL=true e E2E_REAL_EMAIL_TARGET.",
  );

  test.setTimeout(120_000);

  for (const profile of perfisEmailRealSolicitacao) {
    test(`deve solicitar acesso real para ${profile.label}`, async ({ page }) => {
      const unique = Date.now();
      const requestEmail = criarEmailRealUnico(profile.value, unique, REAL_EMAIL);

      await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });
      await abrirFormularioSolicitacaoPublica(page);

      await page.getByTestId("request-access-role-select").selectOption(profile.value);

      if (profile.needsExistingCompany) {
        const companySelect = page.getByTestId("request-access-company-input");

        await expect(companySelect).toBeVisible({ timeout: 30000 });

        await expect
          .poll(async () => companySelect.locator("option").count(), {
            timeout: 30000,
            message: "A empresa de teste precisa aparecer no select.",
          })
          .toBeGreaterThan(1);

        await companySelect.selectOption("cmp_e2e_testing_company");
      }

      await page.getByTestId("request-access-name-input").fill(`Validação ${profile.label} ${unique}`);

      const supportLogin = page.getByLabel("Usuário/login");
      if (await supportLogin.isVisible().catch(() => false)) {
        await supportLogin.fill(requestEmail);
      }

      await page.getByTestId("request-access-email-input").fill(requestEmail);
      await page.getByLabel("Telefone", { exact: true }).fill("55555555555");

      await selecionarCargoAnalista(page);

      await page.getByLabel("Título da solicitação").fill(`Solicitação de acesso - ${profile.label}`);
      await page.getByTestId("request-access-reason-input").fill(
        `Validação do envio de e-mail para ${profile.label}.`,
      );

      await page.getByLabel("Senha escolhida para o novo acesso").fill(PASSWORD);

      const submitResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/access-requests/public") &&
          response.request().method() === "POST",
        { timeout: 60000 },
      );

      await page.getByTestId("request-access-submit-button").click();

      const submitResponse = await submitResponsePromise;
      const responseText = await submitResponse.text().catch(() => "");

      expect(submitResponse.status(), responseText).toBe(201);

      const responseJson = JSON.parse(responseText) as {
        ok?: boolean;
        item?: {
          id?: string;
          requestType?: string;
          requestedCompanyId?: string;
          requestedCompanySlug?: string;
          requesterEmail?: string;
        };
      };

      expect(responseJson.ok).toBeTruthy();
      expect(responseJson.item?.id).toBeTruthy();
      expect(responseJson.item?.requestType).toBe(profile.value);
      expect(responseJson.item?.requesterEmail).toBe(requestEmail);

      if (profile.needsExistingCompany) {
        expect(responseJson.item?.requestedCompanyId).toBe("cmp_e2e_testing_company");
        expect(responseJson.item?.requestedCompanySlug).toBe("Testing Company E2E");
      }
    });
  }
});
