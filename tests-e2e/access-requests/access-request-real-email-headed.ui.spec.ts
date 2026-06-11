import { expect, test } from "@playwright/test";

const REAL_EMAIL = "ana.testing.company@gmail.com";
const PASSWORD = "TESTE123456";

function buildUniqueEmail(profileValue: string, unique: number) {
  const [user, domain] = REAL_EMAIL.split("@");
  return `${user}+${profileValue}.${unique}@${domain}`;
}

const profiles = [
  {
    label: "Usuário da empresa",
    value: "company_user",
    needsExistingCompany: true,
  },
  {
    label: "Usuário TC",
    value: "testing_company_user",
    needsExistingCompany: true,
  },
  {
    label: "Líder TC",
    value: "leader_tc",
    needsExistingCompany: false,
  },
  {
    label: "Suporte Técnico",
    value: "technical_support",
    needsExistingCompany: false,
  },
];


async function openRequestForm(page: import("@playwright/test").Page) {
  await page.goto("/login/access-request", { waitUntil: "domcontentloaded" });

  const formSelect = page.getByTestId("request-access-role-select");

  for (let attempt = 1; attempt <= 3; attempt++) {
    const openButtons = [
      page.getByTestId("open-request-access-form-button"),
      page.getByRole("button", { name: /^Solicitar acesso$/i }),
      page.getByRole("button", { name: /criar solicitação/i }),
      page.getByRole("button", { name: /nova solicitação/i }),
      page.getByRole("button", { name: /pedir acesso/i }),
    ];

    for (const locator of openButtons) {
      const count = await locator.count().catch(() => 0);

      for (let index = 0; index < count; index++) {
        const button = locator.nth(index);

        if (!(await button.isVisible().catch(() => false))) {
          continue;
        }

        await button.scrollIntoViewIfNeeded().catch(() => undefined);
        await expect(button).toBeEnabled({ timeout: 10000 });
        await button.click();

        const opened = await formSelect
          .waitFor({ state: "visible", timeout: 5000 })
          .then(() => true)
          .catch(() => false);

        if (opened) {
          return;
        }
      }
    }

    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(1000);
  }

  const debug = await page.locator("button").evaluateAll((buttons) =>
    buttons.map((button, index) => ({
      index,
      text: (button.textContent ?? "").trim(),
      testid: button.getAttribute("data-testid"),
      aria: button.getAttribute("aria-label"),
      disabled: button.hasAttribute("disabled"),
    })),
  );

  const bodyText = await page.locator("body").innerText().catch(() => "");

  throw new Error(
    `Não abriu o formulário de solicitação. Botões encontrados: ${JSON.stringify(
      debug,
      null,
      2,
    )}

Texto da tela:
${bodyText}`,
  );
}

test.describe("Solicitação pública de acesso com envio real de e-mail", () => {
  test.skip(
    process.env.E2E_SEND_REAL_EMAIL !== "true",
    "Teste protegido: defina E2E_SEND_REAL_EMAIL=true para enviar e-mail real.",
  );

  test.setTimeout(120_000);

  for (const profile of profiles) {
    test(`deve solicitar acesso real para ${profile.label}`, async ({ page }) => {
      const unique = Date.now();
      const requestEmail = buildUniqueEmail(profile.value, unique);

      console.log("[ACCESS REQUEST EXPECTED EMAIL]", {
        profile: profile.label,
        email: requestEmail,
      });

      await openRequestForm(page);

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

      await page.getByTestId("request-access-name-input").fill(`Teste Real ${profile.label} ${unique}`);

      const supportLogin = page.getByLabel("Usuário/login");
      if (await supportLogin.isVisible().catch(() => false)) {
        await supportLogin.fill(requestEmail);
      }

      await page.getByTestId("request-access-email-input").fill(requestEmail);
      await page.getByLabel("Telefone", { exact: true }).fill("55555555555");

      const cargoCombobox = page.getByRole("combobox", { name: /cargo/i });
      if (await cargoCombobox.isVisible().catch(() => false)) {
        await cargoCombobox.click();
        await page.getByRole("option", { name: "Analista de QA" }).click();
      } else {
        await page.locator("label", { hasText: /Cargo|função/i }).locator("select").selectOption("Analista de QA");
      }

      await page.getByLabel("Título da solicitação").fill(`Solicitação real - ${profile.label}`);
      await page.getByTestId("request-access-reason-input").fill(
        `Teste real de envio de e-mail para ${profile.label}.`,
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

      console.log("[ACCESS REQUEST PUBLIC RESPONSE]", {
        status: submitResponse.status(),
        body: responseText,
      });

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
