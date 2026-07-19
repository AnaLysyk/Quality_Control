/**
 * Rodar:
 * npx playwright test tests/api/solicitar-acesso/esqueci-senha.endpoint.api.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";
import { endpointsEsqueciSenha } from "../../../../tools/functions/api/login/esqueci-senha/endpoints/esqueci-senha.endpoints";

test("endpoint nao revela se um email desconhecido esta cadastrado", async ({ request }) => {
  const response = await request.post(endpointsEsqueciSenha.solicitarRedefinicao, {
    data: { email: "email-invalido" },
  });

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true });
});

