// Gate único para todo mecanismo de autenticação/autorização falsa usado em testes E2E
// (mock do Playwright, x-test-admin, mock_role). Fail-closed: só libera com a flag
// explícita E fora de produção. Sem import de "server-only" propositalmente — precisa
// funcionar tanto em rotas Node quanto em middleware/edge.
export function isE2eMockAllowed(): boolean {
  return process.env.PLAYWRIGHT_MOCK === "true" && process.env.NODE_ENV !== "production";
}
