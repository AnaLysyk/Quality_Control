import { test, expect, type APIRequestContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { autenticarContextoSolicitacaoAcesso } from "../../../support/functions/api/solicitar-acesso/autenticar-revisor";
import {
  criarSolicitacaoPublicaViaApi,
  montarPayloadSolicitacaoPublica,
} from "../../../support/functions/api/solicitar-acesso/criar-solicitacao-publica";
import type { PerfilSolicitacaoAcessoPublica } from "../../../support/functions/api/solicitar-acesso/criar-solicitacao-publica";
import {
  criarEmailTeste,
  esperarEmailCapturado,
  limparEmailsCapturados,
} from "../../../support/functions/api/solicitar-acesso/capturar-emails";
import {
  aprovarSolicitacaoViaApiV2,
  consultarSolicitacaoPorChaveAcesso,
  recusarSolicitacaoViaApiV2,
} from "../../../support/functions/api/solicitar-acesso/consultar-status";
import { validarSolicitacaoNaFila } from "../../../support/functions/api/solicitar-acesso/validar-fila-solicitacoes";
import { perfisAutorizadosSolicitacoes } from "../../../support/functions/banco-de-dados/solicitar-acesso/definir-perfis-teste";

type PerfilVisual = {
  role: PerfilSolicitacaoAcessoPublica;
  label: string;
  slug: string;
  needsCompany?: boolean;
};

const perfis: PerfilVisual[] = [
  { role: "empresa", label: "Empresa", slug: "empresa" },
  { role: "company_user", label: "Usuário da empresa", slug: "usuario-da-empresa", needsCompany: true },
  { role: "testing_company_user", label: "Usuário TC", slug: "usuario-tc" },
  { role: "leader_tc", label: "Líder TC", slug: "lider-tc" },
  { role: "technical_support", label: "Suporte técnico", slug: "suporte-tecnico" },
];

const outputDir = resolve("test-results/emails/galeria-visual");

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function salvarEmail(nomeArquivo: string, email: any) {
  mkdirSync(outputDir, { recursive: true });

  const html = email.html
    ? String(email.html)
    : `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(email.subject)}</title></head><body><pre>${escapeHtml(email.text)}</pre></body></html>`;

  writeFileSync(resolve(outputDir, nomeArquivo), html, "utf8");
}

function salvarIndice(links: { perfil: string; tipo: string; arquivo: string; assunto: string; para: string }[]) {
  const rows = links.map((item) => `
    <tr>
      <td>${escapeHtml(item.perfil)}</td>
      <td><strong>${escapeHtml(item.tipo)}</strong></td>
      <td>${escapeHtml(item.assunto)}</td>
      <td>${escapeHtml(item.para)}</td>
      <td><a href="./${escapeHtml(item.arquivo)}" target="_blank">Abrir e-mail</a></td>
    </tr>
  `).join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Galeria visual - e-mails por perfil</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;color:#011848;margin:0;padding:32px}
    h1{margin:0 0 8px}
    p{color:#475569}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px rgba(1,24,72,.12)}
    th,td{padding:14px 16px;border-bottom:1px solid #e5eaf3;text-align:left;font-size:14px}
    th{background:#011848;color:#fff}
    a{color:#ef0001;font-weight:800;text-decoration:none}
  </style>
</head>
<body>
  <h1>Galeria visual - e-mails de acesso por perfil</h1>
  <p>Abra cada e-mail para revisar visualmente aprovação e rejeição por tipo de perfil.</p>
  <table>
    <thead>
      <tr>
        <th>Perfil</th>
        <th>Fluxo</th>
        <th>Assunto</th>
        <th>Para</th>
        <th>Visualização</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  writeFileSync(resolve(outputDir, "index.html"), html, "utf8");
}

async function obterEmpresaParaVinculo(request: APIRequestContext) {
  const response = await request.get("/api/admin/clients");
  const body = await response.json().catch(() => null);

  const candidates = Array.isArray(body)
    ? body
    : Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.clients)
          ? body.clients
          : [];

  const company = candidates.find((item: any) => item?.id || item?.slug || item?.client_id);

  if (!company) {
    return {
      id: "cmp_e2e_testing_company",
      slug: "empresa-e2e-testing-company",
    };
  }

  return {
    id: String(company.id ?? company.client_id ?? company.slug),
    slug: company.slug ? String(company.slug) : "empresa-e2e-testing-company",
  };
}

test.describe("Galeria visual assistida de e-mails por perfil", () => {
  test("gera HTML dos e-mails de aprovação e rejeição dos cinco perfis", async ({ browser }) => {
    limparEmailsCapturados();

    const reviewer = perfisAutorizadosSolicitacoes.find((item) => item.role === "leader_tc")
      ?? perfisAutorizadosSolicitacoes[0];

    const reviewerContext = await browser.newContext();
    const links: { perfil: string; tipo: string; arquivo: string; assunto: string; para: string }[] = [];

    try {
      await autenticarContextoSolicitacaoAcesso(reviewerContext, reviewer.role);
      const request = reviewerContext.request;

      for (const perfil of perfis) {
        const company = perfil.needsCompany ? await obterEmpresaParaVinculo(request) : null;

        const emailAprovacao = criarEmailTeste(`visual-aprovacao-${perfil.slug}`);
        const payloadAprovacao = montarPayloadSolicitacaoPublica(emailAprovacao, {
          requestedRole: perfil.role,
          requestedCompanyId: company?.id,
          requestedCompanySlug: company?.slug,
        });

        const createdApproval = await criarSolicitacaoPublicaViaApi(request, payloadAprovacao);
        await validarSolicitacaoNaFila(request, createdApproval.id);
        await aprovarSolicitacaoViaApiV2(request, createdApproval.id);

        const approvedItem = await consultarSolicitacaoPorChaveAcesso(request, createdApproval.accessKey);
        expect(approvedItem.status).toBe("approved");

        const approvalEmail = await esperarEmailCapturado({
          to: emailAprovacao,
          subject: /aprovada - Quality Control/i,
          contains: ["Senha cadastrada", payloadAprovacao.password],
        });

        const arquivoAprovacao = `aprovacao-${perfil.slug}.html`;
        salvarEmail(arquivoAprovacao, approvalEmail);
        links.push({
          perfil: perfil.label,
          tipo: "Aprovação",
          arquivo: arquivoAprovacao,
          assunto: approvalEmail.subject,
          para: approvalEmail.to,
        });

        const emailRejeicao = criarEmailTeste(`visual-rejeicao-${perfil.slug}`);
        const payloadRejeicao = montarPayloadSolicitacaoPublica(emailRejeicao, {
          requestedRole: perfil.role,
          requestedCompanyId: company?.id,
          requestedCompanySlug: company?.slug,
        });

        const createdRejection = await criarSolicitacaoPublicaViaApi(request, payloadRejeicao);
        await validarSolicitacaoNaFila(request, createdRejection.id);
        await recusarSolicitacaoViaApiV2(request, createdRejection.id);

        const rejectedItem = await consultarSolicitacaoPorChaveAcesso(request, createdRejection.accessKey);
        expect(rejectedItem.status).toBe("rejected");

        const rejectionEmail = await esperarEmailCapturado({
          to: emailRejeicao,
          subject: /rejeitada - Quality Control/i,
          contains: ["Sua solicitação de acesso foi rejeitada", "Motivo informado"],
        });

        const arquivoRejeicao = `rejeicao-${perfil.slug}.html`;
        salvarEmail(arquivoRejeicao, rejectionEmail);
        links.push({
          perfil: perfil.label,
          tipo: "Rejeição",
          arquivo: arquivoRejeicao,
          assunto: rejectionEmail.subject,
          para: rejectionEmail.to,
        });
      }

      salvarIndice(links);
      console.log(`\nGaleria visual criada em: ${resolve(outputDir, "index.html")}\n`);
    } finally {
      await reviewerContext.close();
    }
  });
});
