import { test } from "../fixtures/test";
import {
  validarApiSolicitacoesAcessivel,
  validarApiSolicitacoesNaoQuebra,
} from "../../support/functions/access-requests/access-requests.api";

test.describe("Solicitações - API", () => {
  test("GET /api/admin/access-requests não deve quebrar", async ({ request }) => {
    await validarApiSolicitacoesNaoQuebra(request);
  });

  test("GET /api/admin/access-requests deve responder status controlado", async ({ request }) => {
    await validarApiSolicitacoesAcessivel(request);
  });
});
