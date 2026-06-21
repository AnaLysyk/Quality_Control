/**
 * Rodar:
 * npx playwright test testes/ui/login/solicitar-acesso/lider-tc/criar-solicitacao.ui.spec.ts --project=chromium
 */
/**
 * Rodar visualmente:
 * npx playwright test testes/ui/login/solicitar-acesso/lider-tc/criar-solicitacao.ui.spec.ts --project=chromium --headed --workers=1
 *
 * Rodar sÃ³ no terminal:
 * npx playwright test testes/ui/login/solicitar-acesso/lider-tc/criar-solicitacao.ui.spec.ts --project=chromium --workers=1 --reporter=line
 *
 * Abrir relatÃ³rio HTML:
 * npx playwright show-report
 */

import { expect, test } from "@playwright/test";
import {
  aguardarEmail,
  abrirEmailParaConferencia,
  aguardarConferenciaVisual,
  criarSolicitacaoPublica,
  extrairUrlConsulta,
  limparOutbox,
  validarConsultaPublicaPendente,
  validarEmailRecebido,
  textoEmail,
  type DadosSolicitacaoAcesso,
} from "../../../../../../../support/functions/ui/login/solicitar-acesso/solicitacoes/solicitacao-publica";

test.describe("UI - Login - Solicitar acesso - Líder TC", () => {
  test.beforeEach(() => {
    limparOutbox();
  });

  test("deve criar solicitação, validar e-mail recebido e consultar status pendente", async ({ page }) => {
    const suffix = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;

    const dados: DadosSolicitacaoAcesso = {
      profile: "leader_tc",
      profileLabel: /L.der TC/i,
      requesterName: `Solicitação Líder TC ${suffix}`,
      requesterEmail: `solicitacao-lider-tc-${suffix}@demo.test`,
      requestedUser: `solicitacao-lider-tc-${suffix}`,
      password: "SenhaVisual@123",
      phone: "+55 11 4000-0000",
      title: "Solicitação de acesso Líder TC",
      reason: "ValidaÃ§Ã£o automatizada do fluxo pÃºblico de solicitação de acesso para Líder TC.",
    };

    const response = await criarSolicitacaoPublica(page, dados);

    expect(response.ok).toBe(true);
    expect(response.item.status).toBe("pending");
    expect(response.item.requestedRole).toBe("leader_tc");
    expect(response.item.requesterEmail).toBe(dados.requesterEmail);

    const email = await aguardarEmail((item) => {
      const texto = textoEmail(item);
      return texto.includes(dados.requesterEmail) && texto.includes(dados.requestedUser);
    });

    await validarEmailRecebido(email, dados);

    const emailPage = await abrirEmailParaConferencia(page, email, dados.profile + "-" + suffix + "-email-recebido.html");
    await aguardarConferenciaVisual(emailPage, "E-mail recebido aberto para conferÃªncia");

    const statusUrl = extrairUrlConsulta(email);

    await validarConsultaPublicaPendente(page, statusUrl, dados);
    await aguardarConferenciaVisual(page, "Consulta pública pendente aberta para conferÃªncia");
  });
});






