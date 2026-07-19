/**
 * Rodar:
 * npx playwright test tests/api/solicitar-acesso/redefinir-senha-email.positivo.api.spec.ts --project=chromium
 */
import { expect, test } from "../../../../tools/fixtures/test";
import {
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../../../tools/functions/api/solicitar-acesso/emails/capturar-emails";

const RESET_EMAIL = "e2e-password-reset@testingcompany.local";
const RESET_LOGIN = "e2e.password.reset";
const BASE_PASSWORD = process.env.E2E_PROFILE_PASSWORD ?? "";
const NEW_PASSWORD = `${BASE_PASSWORD.slice(0, 96)}!Reset`;

test.describe("Redefinição de senha - identidade e fluxo real", () => {
  test.beforeEach(() => {
    limparEmailsCapturados();
  });

  test("deve enviar e-mail com identidade, validar token, redefinir e preservar o perfil", async ({
    request,
  }) => {
    const forgotResponse = await request.post("/api/auth/forgot-password", {
      data: {
        email: RESET_EMAIL,
        profile_type: "testing_company_user",
      },
    });
    const forgotBody = await forgotResponse.json().catch(() => null);

    expect(forgotResponse.status(), JSON.stringify(forgotBody)).toBe(200);
    expect(forgotBody?.ok).toBeTruthy();

    const captured = await esperarEmailCapturado({
      to: RESET_EMAIL,
      subject: /Redefinir senha - Quality Control/i,
      contains: [
        "Quality Control",
        "Segurança da sua conta",
        "Redefinir senha",
        "15 minutos",
        "data:image/png;base64,",
        "#011848",
        "#ef0001",
      ],
    });

    const content = `${captured.html}\n${captured.text ?? ""}`;
    const token = content.match(/reset-password\?token=([a-f0-9]+)/i)?.[1] ?? "";
    expect(token).toBeTruthy();
    expect(content).not.toContain(NEW_PASSWORD);
    expect(content).not.toContain(BASE_PASSWORD);

    const validateResponse = await request.post("/api/auth/reset-password/validate", {
      data: { token },
    });
    const validateBody = await validateResponse.json().catch(() => null);
    expect(validateResponse.status(), JSON.stringify(validateBody)).toBe(200);
    expect(validateBody?.valid).toBe(true);

    const confirmResponse = await request.post("/api/auth/reset-password/confirm", {
      data: {
        token,
        newPassword: NEW_PASSWORD,
      },
    });
    const confirmBody = await confirmResponse.json().catch(() => null);
    expect(confirmResponse.status(), JSON.stringify(confirmBody)).toBe(200);
    expect(confirmBody?.ok).toBeTruthy();

    const consumedResponse = await request.post("/api/auth/reset-password/validate", {
      data: { token },
    });
    const consumedBody = await consumedResponse.json().catch(() => null);
    expect(consumedBody?.valid).toBe(false);

    const loginResponse = await request.post("/api/auth/login", {
      data: {
        user: RESET_LOGIN,
        password: NEW_PASSWORD,
      },
    });
    const loginText = await loginResponse.text();
    expect(loginResponse.ok(), loginText).toBeTruthy();

    const meResponse = await request.get("/api/me");
    const meText = await meResponse.text();
    expect(meResponse.ok(), meText).toBeTruthy();

    const me = JSON.parse(meText) as {
      user?: {
        email?: string;
        name?: string;
        username?: string;
        role?: string;
        clientId?: string | null;
      };
      companies?: Array<{ id?: string; name?: string }>;
    };

    expect(me.user?.email).toBe(RESET_EMAIL);
    expect(me.user?.name).toBe("E2E Redefinicao de Senha");
    expect(me.user?.username).toBe(RESET_LOGIN);
    expect(me.user?.role).toBe("testing_company_user");
    expect(me.companies?.some((company) => company.id === "cmp_e2e_testing_company")).toBeTruthy();
  });
});


