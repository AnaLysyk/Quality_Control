import { test, expect, type APIRequestContext } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { autenticarContextoSolicitacaoAcesso } from "../../../support/functions/api/solicitar-acesso/autenticar-revisor";
import { montarPayloadSolicitacaoPublica } from "../../../support/functions/api/solicitar-acesso/criar-solicitacao-publica";

type JsonObject = Record<string, unknown>;

const outputDir = resolve("test-results/solicitar-acesso/correcao-dados-email-consulta");

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function texto(value: unknown) {
  return String(value ?? "").trim();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function salvar(nome: string, conteudo: unknown) {
  mkdirSync(outputDir, { recursive: true });

  if (typeof conteudo === "string") {
    writeFileSync(resolve(outputDir, nome), conteudo, "utf8");
    return;
  }

  writeFileSync(resolve(outputDir, nome), JSON.stringify(conteudo, null, 2), "utf8");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function extrairUrlConsulta(html: string, text: string) {
  const origem = `${html}\n${text}`;
  const match = origem.match(/https?:\/\/[^"'\s<>]+\/login\/access-request\/status\?key=[^"'\s<>]+/i);
  return match?.[0]?.replaceAll("&amp;", "&") ?? "";
}

async function buscarSolicitacaoPorChave(request: APIRequestContext, accessKey: string) {
  const response = await request.get(`/api/access-requests/by-key/${accessKey}`);
  const text = await response.text();

  expect(response.status(), text).toBe(200);

  const body = asObject(parseJson(text));
  return asObject(body.item);
}

async function buscarSolicitacaoAdminPorEmail(request: APIRequestContext, email: string) {
  const response = await request.get("/api/admin/access-requests");
  const text = await response.text();

  expect(response.status(), text).toBe(200);

  const body = asObject(parseJson(text));
  const lista =
    Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.requests)
          ? body.requests
          : Array.isArray(body)
            ? body
            : [];

  const encontrada = lista
    .map(asObject)
    .find((item) => {
      const itemEmail = texto(
        item.requesterEmail ??
          item.email ??
          item.userEmail ??
          asObject(item.item).requesterEmail ??
          asObject(item.item).email,
      ).toLowerCase();

      return itemEmail === email.toLowerCase();
    });

  if (!encontrada) {
    salvar("debug-lista-admin-access-requests.json", body);
    throw new Error(`Solicitação não encontrada no admin para o e-mail ${email}`);
  }

  return encontrada;
}

async function buscarUltimoEmailDeAjuste(_request: APIRequestContext, email: string) {
  const outboxPath = resolve("test-results/emails/outbox.jsonl");

  if (!existsSync(outboxPath)) {
    throw new Error(`Outbox de e-mail não encontrado em ${outboxPath}`);
  }

  const linhas = readFileSync(outboxPath, "utf8")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  const emails = linhas
    .map((linha) => parseJson(linha))
    .map(asObject);

  salvar("debug-outbox-emails.json", emails);

  const encontrado = [...emails]
    .reverse()
    .find((item) => {
      const destinatarios = [
        item.to,
        item.recipient,
        item.email,
        item.toEmail,
        item.requesterEmail,
      ]
        .flat()
        .map(texto)
        .join(" ")
        .toLowerCase();

      const subject = texto(item.subject).toLowerCase();
      const html = texto(item.html ?? item.bodyHtml ?? item.content).toLowerCase();
      const plain = texto(item.text ?? item.bodyText ?? item.plain).toLowerCase();

      return (
        destinatarios.includes(email.toLowerCase()) &&
        (subject.includes("ajuste") || html.includes("ajuste") || plain.includes("ajuste"))
      );
    });

  if (!encontrado) {
    throw new Error(`Não foi possível localizar e-mail de ajuste para ${email}. Veja debug-outbox-emails.json`);
  }

  return encontrado;
}

function gerarRelatorio(data: {
  email: JsonObject;
  urlConsulta: string;
  solicitacaoAntes: JsonObject;
  solicitacaoDepoisDevolver: JsonObject;
  solicitacaoDepoisCorrecao: JsonObject;
  payloadCorrecao: JsonObject;
}) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Correção de dados - e-mail e consulta</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;color:#011848;margin:0;padding:32px}
    h1{margin:0 0 8px}
    h2{margin:28px 0 12px}
    p{color:#475569}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .card{background:#fff;border:1px solid #d8dfeb;border-radius:16px;padding:18px;box-shadow:0 14px 34px rgba(1,24,72,.10)}
    pre{white-space:pre-wrap;word-break:break-word;font-size:12px}
    a{color:#ef0001;font-weight:700}
  </style>
</head>
<body>
  <h1>Correção de dados - e-mail e consulta</h1>
  <p>Validação do fluxo: admin solicita ajuste → e-mail → link público → correção → retorno para análise.</p>

  <div class="card">
    <h2>Link de consulta capturado no e-mail</h2>
    <p><a href="${escapeHtml(data.urlConsulta)}">${escapeHtml(data.urlConsulta)}</a></p>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Solicitação antes</h2>
      <pre>${escapeHtml(JSON.stringify(data.solicitacaoAntes, null, 2))}</pre>
    </div>
    <div class="card">
      <h2>Após solicitar ajuste</h2>
      <pre>${escapeHtml(JSON.stringify(data.solicitacaoDepoisDevolver, null, 2))}</pre>
    </div>
    <div class="card">
      <h2>Payload da correção</h2>
      <pre>${escapeHtml(JSON.stringify(data.payloadCorrecao, null, 2))}</pre>
    </div>
    <div class="card">
      <h2>Após correção do solicitante</h2>
      <pre>${escapeHtml(JSON.stringify(data.solicitacaoDepoisCorrecao, null, 2))}</pre>
    </div>
  </div>
</body>
</html>`;

  salvar("index.html", html);
}

test.describe("Solicitar acesso - correção de dados via e-mail", () => {
  test("deve enviar e-mail de ajuste, abrir consulta por chave e salvar dados corrigidos", async ({ browser }) => {
    mkdirSync(outputDir, { recursive: true });

    const context = await browser.newContext();

    try {
      await autenticarContextoSolicitacaoAcesso(context, "leader_tc");

      const request = context.request;
      const suffix = Date.now();

      const emailSolicitante = `correcao.${suffix}@quality-control.test`;
      const payloadCriacao = montarPayloadSolicitacaoPublica(emailSolicitante, {
        requestedRole: "testing_company_user",
      });

      salvar("00-payload-criacao-publica.json", payloadCriacao);

      const createResponse = await request.post("/api/access-requests/public", {
        data: payloadCriacao,
      });

      const createText = await createResponse.text();
      salvar("solicitacao-criada.json", parseJson(createText) ?? createText);

      expect(createResponse.status(), createText).toBe(201);

      const createBody = asObject(parseJson(createText));
      const created = asObject(createBody.item ?? createBody);

      const email = texto(created.requesterEmail ?? created.item?.requesterEmail ?? emailSolicitante);
      const solicitacaoAdmin = await buscarSolicitacaoAdminPorEmail(request, email);
      salvar("00-solicitacao-admin-criada.json", solicitacaoAdmin);

      const id = texto(solicitacaoAdmin.id ?? created.id ?? created.item?.id);

      expect(id, "ID da solicitação não retornou").not.toBe("");

      const solicitacaoAntes = solicitacaoAdmin;
      salvar("01-solicitacao-antes-admin.json", solicitacaoAntes);

      const payloadAjuste = {
        comment: "Ajustar nome completo, telefone e cargo antes da aprovação.",
        fields: ["fullName", "phone", "jobRole"],
        fieldComments: {
          fullName: "Informe o nome completo revisado.",
          phone: "Atualize o telefone de contato.",
          jobRole: "Confirme o cargo correto.",
        },
      };

      salvar("02-payload-solicitar-ajuste.json", payloadAjuste);

      const adjustmentResponse = await request.post(`/api/admin/access-requests/${id}/request-adjustment`, {
        data: payloadAjuste,
      });

      const adjustmentText = await adjustmentResponse.text();
      salvar("03-resposta-solicitar-ajuste.json", parseJson(adjustmentText) ?? adjustmentText);

      expect(adjustmentResponse.status(), adjustmentText).toBe(200);

      const emailAjuste = await buscarUltimoEmailDeAjuste(request, email);
      salvar("05-email-ajuste.json", emailAjuste);

      const emailHtml = texto(emailAjuste.html ?? emailAjuste.bodyHtml ?? emailAjuste.content ?? "");
      const emailText = texto(emailAjuste.text ?? emailAjuste.bodyText ?? emailAjuste.plain ?? "");
      salvar("06-email-ajuste.html", emailHtml || emailText);

      expect(texto(emailAjuste.subject)).toContain("Ajuste");
      expect(`${emailHtml}\n${emailText}`).toContain("Ajuste");
      expect(`${emailHtml}\n${emailText}`).toContain("Nome");
      expect(`${emailHtml}\n${emailText}`).toContain("Telefone");
      expect(`${emailHtml}\n${emailText}`).toContain("Cargo");

      const urlConsulta = extrairUrlConsulta(emailHtml, emailText);
      salvar("07-url-consulta.txt", urlConsulta);

      expect(urlConsulta).toContain("/login/access-request/status?key=");

      const accessKey = texto(new URL(urlConsulta).searchParams.get("key"));

      expect(accessKey, "Access key não foi encontrada no link do e-mail de ajuste").not.toBe("");
      expect(urlConsulta).toContain(accessKey);
      expect(`${emailHtml}\n${emailText}`).toContain(accessKey);

      const solicitacaoDepoisDevolver = await buscarSolicitacaoPorChave(request, accessKey);
      salvar("04-solicitacao-depois-devolver.json", solicitacaoDepoisDevolver);

      expect(solicitacaoDepoisDevolver.status).toBe("needs_more_info");
      expect(solicitacaoDepoisDevolver.adjustmentFields).toEqual(expect.arrayContaining(["fullName", "phone", "jobRole"]));

      const page = await context.newPage();
      await page.goto(urlConsulta, { waitUntil: "domcontentloaded" });

      await expect(page.getByText(/Corrija este campo|Campos em vermelho|ajuste/i).first()).toBeVisible({
        timeout: 15000,
      });

      await page.screenshot({
        path: resolve(outputDir, "08-tela-consulta-ajuste.png"),
        fullPage: true,
      });

      const payloadCorrecao = {
        fullName: `Solicitante Corrigido ${suffix}`,
        phone: "51999998888",
        jobRole: "QA Corrigido",
      };

      salvar("09-payload-correcao-publica.json", payloadCorrecao);

      const correctionResponse = await request.patch(`/api/access-requests/by-key/${accessKey}`, {
        data: payloadCorrecao,
      });

      const correctionText = await correctionResponse.text();
      salvar("10-resposta-correcao-publica.json", parseJson(correctionText) ?? correctionText);

      expect(correctionResponse.status(), correctionText).toBe(200);

      const solicitacaoDepoisCorrecao = await buscarSolicitacaoPorChave(request, accessKey);
      salvar("11-solicitacao-depois-correcao.json", solicitacaoDepoisCorrecao);

      expect(solicitacaoDepoisCorrecao.status).toBe("under_review");
      expect(solicitacaoDepoisCorrecao.adjustmentFields).toEqual([]);
      expect(solicitacaoDepoisCorrecao.requesterName).toBe(payloadCorrecao.fullName);
      expect(asObject(solicitacaoDepoisCorrecao.details).phone).toBe(payloadCorrecao.phone);
      expect(asObject(solicitacaoDepoisCorrecao.details).jobRole).toBe(payloadCorrecao.jobRole);

      gerarRelatorio({
        email: emailAjuste,
        urlConsulta,
        solicitacaoAntes,
        solicitacaoDepoisDevolver,
        solicitacaoDepoisCorrecao,
        payloadCorrecao,
      });
    } finally {
      await context.close();
    }
  });
});
