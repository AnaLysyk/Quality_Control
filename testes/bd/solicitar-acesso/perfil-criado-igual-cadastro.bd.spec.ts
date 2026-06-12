import { expect, test } from "@playwright/test";
import {
  aprovarSolicitacaoDeAcesso,
  criarSolicitacaoPublicaParaAprovacao,
  lerUsuarioAtual,
  lerUsuarioCriadoNoAdmin,
  loginComoRevisorSolicitacao,
  loginComoUsuarioCriado,
  perfisAprovacaoSolicitacao,
  validarPaginaPerfilUsuarioCriado,
} from "../../../support/functions/banco-de-dados/solicitar-acesso/validar-aprovacao-login-perfil";

test.describe("Solicitação pública de acesso - aprovação, login e perfil", () => {
  test.setTimeout(120_000);

  for (const profile of perfisAprovacaoSolicitacao) {
    test(`deve aprovar, logar e validar perfil para ${profile.label}`, async ({ page }) => {
      const createdRequest = await criarSolicitacaoPublicaParaAprovacao(page, profile);

      await loginComoRevisorSolicitacao(page);

      const username = await aprovarSolicitacaoDeAcesso(
        page,
        createdRequest.requestId,
        createdRequest,
        profile,
      );

      const adminUser = await lerUsuarioCriadoNoAdmin(page, createdRequest.email);

      expect(adminUser.name).toBe(createdRequest.fullName);
      expect(adminUser.email).toBe(createdRequest.email);
      expect(adminUser.user).toBe(username);
      expect(adminUser.role).toBe(profile.expectedRole);
      expect(adminUser.permission_role).toBe(profile.expectedRole);
      expect(adminUser.phone).toBe(createdRequest.phone);
      expect(adminUser.job_title).toBe(createdRequest.role);

      if (profile.needsCompany) {
        expect(adminUser.company_names).toContain("Testing Company E2E");
      } else {
        expect(adminUser.client_id).toBeFalsy();
      }

      await loginComoUsuarioCriado(page, username, profile);

      const me = await lerUsuarioAtual(page);

      expect(me.user?.email).toBe(createdRequest.email);
      expect(me.user?.name).toBe(createdRequest.fullName);
      expect(me.user?.username).toBe(username);

      expect(me.user?.role).toBe(profile.expectedRole);
      expect(me.user?.isGlobalAdmin).toBe(profile.expectedGlobalAdmin);

      expect(me.user?.phone).toBe("55555555555");
      expect(me.user?.jobTitle ?? me.user?.job_title).toBe("Analista de QA");

      if (profile.needsCompany) {
        expect(me.companies?.some((company) => company.id === "cmp_e2e_testing_company")).toBeTruthy();
        if (profile.expectsPrimaryClient) {
          expect(me.user?.clientId).toBe("cmp_e2e_testing_company");
        }
      } else {
        expect(me.user?.clientId).toBeFalsy();
      }

      await validarPaginaPerfilUsuarioCriado(page, {
        fullName: createdRequest.fullName,
        username,
        email: createdRequest.email,
        phone: createdRequest.phone,
        jobTitle: createdRequest.role,
      });
    });
  }
});
