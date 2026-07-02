/**
 * Rodar:
 * npx playwright test testes/api/solicitar-acesso/endpoints-publicos.api.spec.ts --project=chromium
 */
import { expect, test } from "@playwright/test";
import { endpointsSolicitarAcesso } from "../../../../support/functions/api/solicitar-acesso/endpoints/solicitar-acesso.endpoints";

test("consulta publica rejeita chave inexistente sem expor erro interno", async ({ request }) => {
  const response = await request.get(
    endpointsSolicitarAcesso.consultarPorChave("chave-inexistente"),
  );
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toMatch(/stack|prisma|database|password/i);
});

test("listagem administrativa exige autenticacao", async ({ request }) => {
  const response = await request.get(endpointsSolicitarAcesso.listarAdministrativo);
  expect([401, 403]).toContain(response.status());
});

