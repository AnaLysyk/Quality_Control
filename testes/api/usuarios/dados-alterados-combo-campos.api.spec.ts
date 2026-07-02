import { test, expect, type APIRequestContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { autenticarContextoSolicitacaoAcesso } from "../../../support/functions/api/solicitar-acesso/autenticacao/autenticar-revisor";

type JsonObject = Record<string, unknown>;

type ValidacaoCampo = {
  campo: string;
  esperado: unknown;
  atual: unknown;
  status: "OK" | "FALHOU";
};

const outputDir = resolve("test-results/dados-alterados/combo-campos");

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function salvarJson(nome: string, conteudo: unknown) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, nome), JSON.stringify(conteudo, null, 2), "utf8");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function valorPorAlias(item: JsonObject, aliases: string[]) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(item, alias)) {
      return item[alias];
    }
  }

  return undefined;
}

function texto(value: unknown) {
  return String(value ?? "").trim();
}

function validarTexto(
  validacoes: ValidacaoCampo[],
  item: JsonObject,
  campo: string,
  aliases: string[],
  esperado: string,
) {
  const atual = valorPorAlias(item, aliases);
  validacoes.push({
    campo,
    esperado,
    atual,
    status: texto(atual) === texto(esperado) ? "OK" : "FALHOU",
  });
}

function validarBooleano(
  validacoes: ValidacaoCampo[],
  item: JsonObject,
  campo: string,
  aliases: string[],
  esperado: boolean,
) {
  const atual = valorPorAlias(item, aliases);
  validacoes.push({
    campo,
    esperado,
    atual,
    status: atual === esperado ? "OK" : "FALHOU",
  });
}

function validarPerfilTecnico(validacoes: ValidacaoCampo[], item: JsonObject) {
  const valores = [
    valorPorAlias(item, ["profile_kind"]),
    valorPorAlias(item, ["permission_role"]),
    valorPorAlias(item, ["role"]),
  ].map((value) => texto(value));

  const ok = valores.includes("technical_support") || valores.includes("support");

  validacoes.push({
    campo: "Perfil / role",
    esperado: "technical_support",
    atual: valores.filter(Boolean).join(" | "),
    status: ok ? "OK" : "FALHOU",
  });
}

function extrairUsuario(body: unknown): JsonObject {
  const obj = asObject(body);
  return asObject(obj.item ?? obj.user ?? obj.data ?? body);
}

async function buscarUsuario(request: APIRequestContext, userId: string) {
  const directResponse = await request.get(`/api/admin/users/${userId}`);
  const directText = await directResponse.text();

  if (directResponse.ok()) {
    const directBody = parseJson(directText);
    const directUser = extrairUsuario(directBody);

    if (directUser.id) {
      return directUser;
    }
  }

  const listResponse = await request.get("/api/admin/users");
  const listText = await listResponse.text();

  expect(listResponse.status(), listText).toBe(200);

  const listBody = asObject(parseJson(listText));
  const candidates =
    Array.isArray(listBody.items)
      ? listBody.items
      : Array.isArray(listBody.users)
        ? listBody.users
        : Array.isArray(listBody.data)
          ? listBody.data
          : Array.isArray(parseJson(listText))
            ? (parseJson(listText) as unknown[])
            : [];

  const found = candidates
    .map(asObject)
    .find((item) => item.id === userId);

  expect(found, `Usuário ${userId} não encontrado na consulta`).toBeTruthy();

  return asObject(found);
}

function salvarRelatorioHtml(validacoes: ValidacaoCampo[], payloadCriacao: unknown, payloadAlteracao: unknown) {
  mkdirSync(outputDir, { recursive: true });

  const linhas = validacoes.map((item) => {
    const statusClass = item.status === "OK" ? "ok" : "fail";

    return `
      <tr>
        <td>${escapeHtml(item.campo)}</td>
        <td><pre>${escapeHtml(JSON.stringify(item.esperado, null, 2))}</pre></td>
        <td><pre>${escapeHtml(JSON.stringify(item.atual, null, 2))}</pre></td>
        <td class="${statusClass}">${item.status}</td>
      </tr>
    `;
  }).join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dados Alterados - Combo de campos</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;color:#011848;margin:0;padding:32px}
    h1{margin:0 0 8px}
    p{color:#475569}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:22px 0}
    .card{background:#fff;border:1px solid #d8dfeb;border-radius:16px;padding:18px;box-shadow:0 14px 34px rgba(1,24,72,.10)}
    pre{white-space:pre-wrap;word-break:break-word;margin:0;font-size:12px}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px rgba(1,24,72,.12)}
    th,td{padding:12px 14px;border-bottom:1px solid #e5eaf3;text-align:left;vertical-align:top;font-size:14px}
    th{background:#011848;color:#fff}
    .ok{color:#166534;font-weight:900}
    .fail{color:#991b1b;font-weight:900}
  </style>
</head>
<body>
  <h1>Dados Alterados - Combo de campos</h1>
  <p>Validação API + persistência dos campos editáveis do usuário.</p>

  <div class="grid">
    <div class="card">
      <h2>Payload de criação</h2>
      <pre>${escapeHtml(JSON.stringify(payloadCriacao, null, 2))}</pre>
    </div>
    <div class="card">
      <h2>Payload de alteração</h2>
      <pre>${escapeHtml(JSON.stringify(payloadAlteracao, null, 2))}</pre>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Campo</th>
        <th>Esperado</th>
        <th>Atual</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>
</body>
</html>`;

  writeFileSync(resolve(outputDir, "index.html"), html, "utf8");
}

test.describe("Dados Alterados - combo de campos do usuário", () => {
  test("deve criar, alterar e validar todos os campos editáveis do usuário", async ({ browser }) => {
    const context = await browser.newContext();

    try {
      await autenticarContextoSolicitacaoAcesso(context, "leader_tc");

      const request = context.request;
      const suffix = Date.now();

      const payloadCriacao = {
        full_name: `Combo Dados Criacao ${suffix}`,
        name: `Combo Dados Criacao ${suffix}`,
        user: `combo.dados.${suffix}`,
        email: `combo.dados.${suffix}@quality-control.test`,
        phone: "51988880000",
        role: "testing_company_user",
        job_title: "Analista QA Combo",
        linkedin_url: "https://www.linkedin.com/in/qa-combo-dados",
        avatar_url: "https://example.com/avatar-combo-criacao.png",
        active: true,
      };

      salvarJson("payload-criacao.json", payloadCriacao);

      const createResponse = await request.post("/api/admin/users", {
        data: payloadCriacao,
      });

      const createText = await createResponse.text();
      expect(createResponse.status(), createText).toBe(201);

      const createBody = asObject(parseJson(createText));
      salvarJson("resposta-criacao.json", createBody);

      const createdUser = extrairUsuario(createBody);
      const userId = texto(createdUser.id ?? createBody.id);

      expect(userId, "ID do usuário criado não retornou").not.toBe("");

      const usuarioAposCriacao = await buscarUsuario(request, userId);
      salvarJson("usuario-apos-criacao.json", usuarioAposCriacao);

      const payloadAlteracao = {
        id: userId,
        full_name: `Combo Dados Alterado ${suffix}`,
        name: `Combo Dados Alterado ${suffix}`,
        user: `combo.dados.alt.${suffix}`,
        email: `combo.dados.alt.${suffix}@quality-control.test`,
        phone: "51977770000",
        role: "technical_support",
        job_title: "QA Alterado Combo",
        linkedin_url: "https://www.linkedin.com/in/qa-combo-dados-alterado",
        avatar_url: "https://example.com/avatar-combo-alterado.png",
        active: false,
      };

      salvarJson("payload-alteracao.json", payloadAlteracao);

      const updateResponse = await request.patch("/api/admin/users", {
        data: payloadAlteracao,
      });

      const updateText = await updateResponse.text();
      expect(updateResponse.status(), updateText).toBe(200);

      const updateBody = parseJson(updateText);
      salvarJson("resposta-alteracao.json", updateBody);

      const usuarioAposAlteracao = await buscarUsuario(request, userId);
      salvarJson("usuario-apos-alteracao.json", usuarioAposAlteracao);

      const validacoes: ValidacaoCampo[] = [];

      validarTexto(validacoes, usuarioAposAlteracao, "Nome", ["name", "full_name"], payloadAlteracao.name);
      validarTexto(validacoes, usuarioAposAlteracao, "Nome completo", ["full_name", "name"], payloadAlteracao.full_name);
      validarTexto(validacoes, usuarioAposAlteracao, "Usuário/login", ["user", "username", "login"], payloadAlteracao.user);
      validarTexto(validacoes, usuarioAposAlteracao, "E-mail", ["email"], payloadAlteracao.email);
      validarTexto(validacoes, usuarioAposAlteracao, "Telefone", ["phone"], payloadAlteracao.phone);
      validarTexto(validacoes, usuarioAposAlteracao, "Cargo", ["job_title", "jobTitle"], payloadAlteracao.job_title);
      validarTexto(validacoes, usuarioAposAlteracao, "LinkedIn", ["linkedin_url", "linkedinUrl"], payloadAlteracao.linkedin_url);
      validarTexto(validacoes, usuarioAposAlteracao, "Avatar/foto", ["avatar_url", "avatarUrl"], payloadAlteracao.avatar_url);
      validarBooleano(validacoes, usuarioAposAlteracao, "Ativo", ["active"], payloadAlteracao.active);
      validarPerfilTecnico(validacoes, usuarioAposAlteracao);

      salvarJson("campos-validados.json", validacoes);
      salvarRelatorioHtml(validacoes, payloadCriacao, payloadAlteracao);

      const falhas = validacoes.filter((item) => item.status === "FALHOU");
      expect(falhas, JSON.stringify(falhas, null, 2)).toEqual([]);
    } finally {
      await context.close();
    }
  });
});


