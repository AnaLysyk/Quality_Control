import { expect, test } from "../fixtures/test";
import { mockAuth } from "../helpers/mockAuth";
import {
  accessRequestsRoute,
  allowedAccessRequestRoles,
  deniedAccessRequestRoles,
} from "../../support/functions/access-requests/access-requests.roles";
import {
  abrirModuloSolicitacoes,
  validarAcessoNegadoAoModuloSolicitacoes,
  validarRotaRemovidaNaoExiste,
  validarTelaSolicitacoes,
} from "../../support/functions/access-requests/access-requests.ui";

test.describe("Solicitações - acesso por perfil - UI", () => {
  for (const perfil of allowedAccessRequestRoles) {
    test(`${perfil.label} deve visualizar o módulo Solicitações`, async ({ page, context }) => {
      await mockAuth(context, {
        role: perfil.role,
        permissionRole: perfil.role,
        companyRole: perfil.role,
        companySlug: "testing-company",
        companySlugs: ["testing-company"],
        clientSlug: "testing-company",
        isGlobalAdmin: perfil.role === "leader_tc",
        email: perfil.email,
        name: perfil.name,
      });

      await abrirModuloSolicitacoes(page);
      await validarTelaSolicitacoes(page);

      await expect(page).toHaveURL(new RegExp(accessRequestsRoute));
    });
  }

  for (const perfil of deniedAccessRequestRoles) {
    test(`${perfil.label} não deve acessar o módulo Solicitações`, async ({ page, context }) => {
      await mockAuth(context, {
        role: perfil.role,
        permissionRole: perfil.role,
        companyRole: perfil.role,
        companySlug: "testing-company",
        companySlugs: ["testing-company"],
        clientSlug: "testing-company",
        isGlobalAdmin: false,
        email: perfil.email,
        name: perfil.name,
      });

      await validarAcessoNegadoAoModuloSolicitacoes(page);
    });
  }

  test("rota antiga /admin/requests não deve existir como fluxo válido", async ({ page, context }) => {
    await mockAuth(context, {
      role: "leader_tc",
      permissionRole: "leader_tc",
      companyRole: "leader_tc",
      companySlug: "testing-company",
      companySlugs: ["testing-company"],
      clientSlug: "testing-company",
      isGlobalAdmin: true,
      email: "e2e-leader-tc@testingcompany.local",
      name: "E2E Líder TC",
    });

    await validarRotaRemovidaNaoExiste(page);
  });
});



