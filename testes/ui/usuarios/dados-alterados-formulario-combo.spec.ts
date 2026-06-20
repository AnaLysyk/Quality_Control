import { test, expect, type APIRequestContext } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { autenticarContextoSolicitacaoAcesso } from "../../../support/functions/api/solicitar-acesso/autenticar-revisor";

type JsonObject = Record<string, unknown>;

type ValidacaoCampo = {
  campo: string;
  esperado: unknown;
  atual: unknown;
  status: "OK" | "FALHOU";
};

const outputDir = resolve("test-results/dados-alterados/formulario-combo");

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

function texto(value: unknown) {
  return String(value ?? "").trim();
}

function valorPorAlias(item: JsonObject, aliases: string[]) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(item, alias)) {
      return item[alias];
    }
  }

  return undefined;
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

async function obterEmpresaParaVinculo(request: APIRequestContext) {
  const response = await request.get("/api/companies");
  const text = await response.text();

  expect(response.status(), text).toBe(200);

  const body = parseJson(text);
  const obj = asObject(body);

  const candidates =
    Array.isArray(body)
      ? body
      : Array.isArray(obj.items)
        ? obj.items
        : Array.isArray(obj.data)
          ? obj.data
          : Array.isArray(obj.clients)
            ? obj.clients
            : [];

  const company = candidates
    .map(asObject)
    .find((item) => item.id || item.client_id || item.slug);

  expect(company, "Nenhuma empresa encontrada para criar usuário vinculado").toBeTruthy();

  return {
    id: texto(company?.id ?? company?.client_id ?? company?.slug),
    slug: texto(company?.slug ?? ""),
    name: texto(company?.name ?? company?.company_name ?? company?.fantasy_name ?? company?.slug),
  };
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

function salvarRelatorioHtml(
  validacoesPayload: ValidacaoCampo[],
  validacoesPersistencia: ValidacaoCampo[],
  payloadCapturado: unknown,
  usuarioAposAlteracao: unknown,
) {
  mkdirSync(outputDir, { recursive: true });

  const renderTabela = (titulo: string, validacoes: ValidacaoCampo[]) => {
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

    return `
      <h2>${escapeHtml(titulo)}</h2>
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
    `;
  };

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Dados Alterados - Formulário assistido</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;color:#011848;margin:0;padding:32px}
    h1{margin:0 0 8px}
    h2{margin:28px 0 12px}
    p{color:#475569}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:22px 0}
    .card{background:#fff;border:1px solid #d8dfeb;border-radius:16px;padding:18px;box-shadow:0 14px 34px rgba(1,24,72,.10)}
    pre{white-space:pre-wrap;word-break:break-word;margin:0;font-size:12px}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 16px 40px rgba(1,24,72,.12);margin-bottom:28px}
    th,td{padding:12px 14px;border-bottom:1px solid #e5eaf3;text-align:left;vertical-align:top;font-size:14px}
    th{background:#011848;color:#fff}
    .ok{color:#166534;font-weight:900}
    .fail{color:#991b1b;font-weight:900}
  </style>
</head>
<body>
  <h1>Dados Alterados - Formulário assistido</h1>
  <p>Validação do formulário real: tela → PATCH capturado → persistência na API.</p>

  <div class="grid">
    <div class="card">
      <h2>Payload capturado do PATCH</h2>
      <pre>${escapeHtml(JSON.stringify(payloadCapturado, null, 2))}</pre>
    </div>
    <div class="card">
      <h2>Usuário após alteração</h2>
      <pre>${escapeHtml(JSON.stringify(usuarioAposAlteracao, null, 2))}</pre>
    </div>
  </div>

  ${renderTabela("Validação do payload enviado pela tela", validacoesPayload)}
  ${renderTabela("Validação da persistência após salvar", validacoesPersistencia)}
</body>
</html>`;

  writeFileSync(resolve(outputDir, "index.html"), html, "utf8");
}

async function selecionarPrimeiroCargoValido(page: import("@playwright/test").Page) {
  const cargoContainer = page.locator("label").filter({ hasText: "Cargo" });
  await cargoContainer.getByRole("combobox").click();

  const option = page
    .getByRole("option")
    .filter({ hasNotText: /Não informado|Nao informado/i })
    .first();

  await expect(option).toBeVisible();

  const cargoSelecionado = texto(await option.innerText());
  await option.click();

  return cargoSelecionado;
}

test.describe("Dados Alterados - formulário assistido", () => {
  test("deve alterar todos os campos editáveis pela tela e capturar o PATCH correto", async ({ browser }) => {
    const context = await browser.newContext();

    try {
      await autenticarContextoSolicitacaoAcesso(context, "leader_tc");

      const request = context.request;
      const page = await context.newPage();
      const suffix = Date.now();

      const company = await obterEmpresaParaVinculo(request);

      const payloadCriacao = {
        full_name: `UI Dados Criacao ${suffix}`,
        name: `UI Dados Criacao ${suffix}`,
        user: `ui.dados.${suffix}`,
        email: `ui.dados.${suffix}@quality-control.test`,
        phone: "51988881111",
        role: "company_user",
        client_id: company.id,
        job_title: "Analista QA Combo",
        linkedin_url: "https://www.linkedin.com/in/ui-dados-criacao",
        avatar_url: "https://example.com/avatar-ui-criacao.png",
        active: true,
      };

      salvarJson("payload-criacao-api.json", payloadCriacao);

      const createResponse = await request.post("/api/admin/users", {
        data: payloadCriacao,
      });

      const createText = await createResponse.text();
      expect(createResponse.status(), createText).toBe(201);

      const createBody = asObject(parseJson(createText));
      salvarJson("resposta-criacao-api.json", createBody);

      const createdUser = extrairUsuario(createBody);
      const userId = texto(createdUser.id ?? createBody.id);

      expect(userId, "ID do usuário criado não retornou").not.toBe("");

      const esperado = {
        id: userId,
        name: `UI Dados Alterado ${suffix}`,
        full_name: `UI Dados Alterado ${suffix}`,
        user: `ui.dados.alt.${suffix}`,
        email: `ui.dados.alt.${suffix}@quality-control.test`,
        phone: "51977771111",
        role: "technical_support",
        job_title: "",
        linkedin_url: "https://www.linkedin.com/in/ui-dados-alterado",
        avatar_url: "https://example.com/avatar-ui-alterado.png",
        active: false,
      };

      mkdirSync(outputDir, { recursive: true });

      await page.goto("/admin/users", { waitUntil: "domcontentloaded" });

      const searchInput = page.getByTestId("users-search-input");

      try {
        await expect(searchInput).toBeVisible({ timeout: 15000 });
      } catch (error) {
        await page.screenshot({
          path: resolve(outputDir, "debug-admin-users-nao-carregou.png"),
          fullPage: true,
        });

        writeFileSync(resolve(outputDir, "debug-admin-users-nao-carregou.html"), await page.content(), "utf8");
        writeFileSync(
          resolve(outputDir, "debug-admin-users-url.txt"),
          page.url(),
          "utf8",
        );

        throw error;
      }

      await searchInput.fill(payloadCriacao.email);

      const userCard = page
        .getByRole("button")
        .filter({ hasText: payloadCriacao.email })
        .first();

      try {
        await expect(userCard).toBeVisible({ timeout: 15000 });
      } catch (error) {
        await page.screenshot({
          path: resolve(outputDir, "debug-usuario-nao-apareceu-na-lista.png"),
          fullPage: true,
        });

        writeFileSync(resolve(outputDir, "debug-usuario-nao-apareceu-na-lista.html"), await page.content(), "utf8");
        writeFileSync(
          resolve(outputDir, "debug-usuario-nao-apareceu-na-lista.txt"),
          JSON.stringify({ url: page.url(), email: payloadCriacao.email, company }, null, 2),
          "utf8",
        );

        throw error;
      }

      await userCard.click();

      await expect(page.getByText(/Sincronizacao ativa|Sincronização ativa/i)).toBeVisible();

      await page.getByLabel(/Nome completo/i).fill(esperado.name);
      await page.getByLabel(/Usu.rio \(login\)/i).fill(esperado.user);
      await page.getByLabel(/Email/i).fill(esperado.email);
      await page.getByLabel(/Telefone/i).fill(esperado.phone);
      await page.getByLabel(/LinkedIn/i).fill(esperado.linkedin_url);

      const cargoSelecionado = await selecionarPrimeiroCargoValido(page);
      esperado.job_title = cargoSelecionado;

      await page.getByLabel(/Perfil do usu.rio/i).selectOption(esperado.role);

      const statusCheckbox = page.getByLabel(/Usu.rio ativo|Usu.rio inativo/i);
      await statusCheckbox.setChecked(esperado.active);

      await page.getByLabel(/Foto por URL/i).fill(esperado.avatar_url);

      const patchRequestPromise = page.waitForRequest((req) => {
        return req.method() === "PATCH" && req.url().includes(`/api/admin/users/${userId}`);
      });

      const patchResponsePromise = page.waitForResponse((res) => {
        return res.request().method() === "PATCH" && res.url().includes(`/api/admin/users/${userId}`);
      });

      await page.getByRole("button", { name: /Salvar altera/i }).click();

      const patchRequest = await patchRequestPromise;
      const patchResponse = await patchResponsePromise;

      const payloadCapturado = asObject(patchRequest.postDataJSON());
      salvarJson("payload-capturado-patch-ui.json", payloadCapturado);

      const patchResponseText = await patchResponse.text();
      salvarJson("resposta-patch-ui.json", parseJson(patchResponseText) ?? patchResponseText);

      expect(patchResponse.status(), patchResponseText).toBe(200);

      const usuarioAposAlteracao = await buscarUsuario(request, userId);
      salvarJson("usuario-apos-alteracao.json", usuarioAposAlteracao);

      const validacoesPayload: ValidacaoCampo[] = [];

      validarTexto(validacoesPayload, payloadCapturado, "ID", ["id"], esperado.id);
      validarTexto(validacoesPayload, payloadCapturado, "Nome", ["name"], esperado.name);
      validarTexto(validacoesPayload, payloadCapturado, "Nome completo", ["full_name"], esperado.full_name);
      validarTexto(validacoesPayload, payloadCapturado, "Usuário/login", ["user"], esperado.user);
      validarTexto(validacoesPayload, payloadCapturado, "E-mail", ["email"], esperado.email);
      validarTexto(validacoesPayload, payloadCapturado, "Telefone", ["phone"], esperado.phone);
      validarTexto(validacoesPayload, payloadCapturado, "Cargo", ["job_title"], esperado.job_title);
      validarTexto(validacoesPayload, payloadCapturado, "LinkedIn", ["linkedin_url"], esperado.linkedin_url);
      validarTexto(validacoesPayload, payloadCapturado, "Avatar/foto", ["avatar_url"], esperado.avatar_url);
      validarTexto(validacoesPayload, payloadCapturado, "Perfil", ["role"], esperado.role);
      validarBooleano(validacoesPayload, payloadCapturado, "Ativo", ["active"], esperado.active);

      const validacoesPersistencia: ValidacaoCampo[] = [];

      validarTexto(validacoesPersistencia, usuarioAposAlteracao, "Nome", ["name", "full_name"], esperado.name);
      validarTexto(validacoesPersistencia, usuarioAposAlteracao, "Nome completo", ["full_name", "name"], esperado.full_name);
      validarTexto(validacoesPersistencia, usuarioAposAlteracao, "Usuário/login", ["user", "username", "login"], esperado.user);
      validarTexto(validacoesPersistencia, usuarioAposAlteracao, "E-mail", ["email"], esperado.email);
      validarTexto(validacoesPersistencia, usuarioAposAlteracao, "Telefone", ["phone"], esperado.phone);
      validarTexto(validacoesPersistencia, usuarioAposAlteracao, "Cargo", ["job_title", "jobTitle"], esperado.job_title);
      validarTexto(validacoesPersistencia, usuarioAposAlteracao, "LinkedIn", ["linkedin_url", "linkedinUrl"], esperado.linkedin_url);
      validarTexto(validacoesPersistencia, usuarioAposAlteracao, "Avatar/foto", ["avatar_url", "avatarUrl"], esperado.avatar_url);
      validarBooleano(validacoesPersistencia, usuarioAposAlteracao, "Ativo", ["active"], esperado.active);
      validarPerfilTecnico(validacoesPersistencia, usuarioAposAlteracao);

      salvarJson("campos-validados-payload-ui.json", validacoesPayload);
      salvarJson("campos-validados-persistencia.json", validacoesPersistencia);

      salvarRelatorioHtml(
        validacoesPayload,
        validacoesPersistencia,
        payloadCapturado,
        usuarioAposAlteracao,
      );

      await page.screenshot({
        path: resolve(outputDir, "tela-apos-salvar.png"),
        fullPage: true,
      });

      const falhas = [...validacoesPayload, ...validacoesPersistencia].filter(
        (item) => item.status === "FALHOU",
      );

      expect(falhas, JSON.stringify(falhas, null, 2)).toEqual([]);
    } finally {
      await context.close();
    }
  });
});


