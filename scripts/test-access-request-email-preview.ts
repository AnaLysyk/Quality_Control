import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

type CapturedEmail = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  profile: string;
  event: string;
};

const outputDir = path.resolve("test-results/emails/preview-access-requests");
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const fakeInbox = "fake-inbox@testingcompany.local";

const profiles = [
  { key: "empresa", label: "Empresa", companySlug: "empresa-validacao-email" },
  { key: "company_user", label: "Usuário da empresa", companySlug: "empresa-validacao-email" },
  { key: "testing_company_user", label: "Usuário Testing Company", companySlug: "testing-company" },
  { key: "leader_tc", label: "Líder TC", companySlug: "testing-company" },
  { key: "technical_support", label: "Suporte técnico", companySlug: "testing-company" },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function createReceivedEmail(profile: (typeof profiles)[number]): CapturedEmail {
  const accessKey = `fake-key-${profile.key}-123456`;
  const statusUrl = `http://localhost:3000/login/access-request/status?key=${accessKey}`;

  const subject = `Solicitação de acesso recebida - ${profile.label} - Quality Control`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;color:#011848}
    .page{padding:42px 12px;background:linear-gradient(135deg,#011848 0%,#eef2f8 48%,#ef0001 100%)}
    .card{max-width:780px;margin:0 auto;background:#fff;border-radius:26px;overflow:hidden;box-shadow:0 24px 70px rgba(1,24,72,.25)}
    .header{background:linear-gradient(135deg,#011848 0%,#142b63 48%,#ef0001 100%);color:#fff;padding:44px 42px;text-align:center}
    .brand{display:inline-block;margin-bottom:14px;padding:8px 18px;border:1px solid rgba(255,255,255,.34);border-radius:999px;background:rgba(255,255,255,.12);font-size:13px;font-weight:800}
    .content{padding:42px 46px 36px}
    .badge{display:inline-block;padding:8px 14px;border-radius:999px;background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;font-weight:800;margin-bottom:18px}
    .box{margin:22px 0;padding:18px 20px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:16px;color:#27457d}
    .button{display:inline-block;padding:16px 38px;border-radius:14px;background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#fff!important;text-decoration:none;font-weight:900}
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div class="brand">Testing Company</div>
        <h1>Quality Control</h1>
        <p>Solicitação de acesso recebida</p>
      </div>
      <div class="content">
        <span class="badge">Em análise</span>
        <h2>Olá, Ana Validação ${profile.label}!</h2>
        <p>Recebemos sua solicitação de acesso para o perfil <strong>${profile.label}</strong>.</p>

        <div class="box">
          <strong>Dados da solicitação</strong><br>
          Login cadastrado: fake.${profile.key}@testingcompany.local<br>
          Senha: use a senha cadastrada no momento da solicitação<br>
          Perfil solicitado: ${profile.label}<br>
          Empresa vinculada: ${profile.companySlug}<br>
          Código de acesso: ${accessKey}
        </div>

        <p>Você receberá uma atualização quando a solicitação for aprovada, recusada ou precisar de ajuste.</p>
        <p style="text-align:center"><a class="button" href="${statusUrl}">Consultar solicitação</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return {
    to: fakeInbox,
    subject,
    html,
    text: `Solicitação recebida
Perfil solicitado: ${profile.label}
Login cadastrado: fake.${profile.key}@testingcompany.local
Senha: use a senha cadastrada no momento da solicitação
Código de acesso: ${accessKey}
${statusUrl}`,
    profile: profile.key,
    event: "recebida",
  };
}

async function main() {
  process.env.FORCE_EMAIL_SEND = "true";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";

  const { emailService } = await import("../lib/email");

  const captured: CapturedEmail[] = [];
  const originalSendEmail = emailService.sendEmail.bind(emailService);

  emailService.sendEmail = async (options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) => {
    captured.push({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      profile: "unknown",
      event: "unknown",
    });

    return true;
  };

  for (const profile of profiles) {
    captured.push(createReceivedEmail(profile));

    await emailService.sendAccessApprovedEmail(fakeInbox, {
      name: `Ana Validação ${profile.label}`,
      login: `fake.${profile.key}@testingcompany.local`,
      tempPassword: null,
      passwordFromRequest: true,
      profileType: profile.key,
      companySlug: profile.companySlug,
    });

    captured[captured.length - 1].profile = profile.key;
    captured[captured.length - 1].event = "aprovado";

    await emailService.sendAccessAdjustmentEmail(fakeInbox, {
      name: `Ana Validação ${profile.label}`,
      accessKey: `fake-key-ajuste-${profile.key}`,
      adjustmentFields: [
        "Nome completo",
        "E-mail",
        "Telefone",
        "Empresa",
        "Perfil solicitado",
      ],
      comment: `Ajuste solicitado para validar o e-mail do perfil ${profile.label}.`,
    });

    captured[captured.length - 1].profile = profile.key;
    captured[captured.length - 1].event = "ajuste";

    await emailService.sendAccessRejectedEmail(fakeInbox, {
      name: `Ana Validação ${profile.label}`,
      accessKey: `fake-key-recusa-${profile.key}`,
      comment: `Solicitação recusada para validar o e-mail do perfil ${profile.label}.`,
    });

    captured[captured.length - 1].profile = profile.key;
    captured[captured.length - 1].event = "recusado";
  }

  emailService.sendEmail = originalSendEmail;

  const indexRows: string[] = [];

  for (const email of captured) {
    const fileName = `${safeFileName(email.profile)}-${safeFileName(email.event)}.html`;
    const filePath = path.join(outputDir, fileName);

    fs.writeFileSync(filePath, email.html, "utf-8");

    const searchable = normalize(`${email.subject}\n${email.text ?? ""}\n${email.html}`);

    assert.equal(email.to, fakeInbox, "Todos os e-mails precisam ir para a caixa fake");
    assert.ok(searchable.includes("quality control"), "E-mail precisa ter Quality Control");
    assert.ok(searchable.includes("testing company"), "E-mail precisa ter Testing Company");
    assert.ok(searchable.includes("acessar") || searchable.includes("consultar"), "E-mail precisa ter botão/link de ação");

    if (email.event === "recebida") {
      assert.ok(searchable.includes("em analise"), "E-mail recebido precisa indicar análise");
      assert.ok(searchable.includes("codigo de acesso") || searchable.includes("chave de acesso"), "E-mail recebido precisa ter código/chave");
    }

    if (email.event === "aprovado") {
      assert.ok(searchable.includes("senha cadastrada") || searchable.includes("senha definida"), "E-mail aprovado precisa orientar sobre senha cadastrada");
      assert.ok(searchable.includes("meu perfil"), "E-mail aprovado precisa orientar troca em Meu Perfil");
    }

    if (email.event === "ajuste") {
      assert.ok(searchable.includes("ajuste"), "E-mail de ajuste precisa indicar ajuste");
      assert.ok(searchable.includes("observacao") || searchable.includes("revisor"), "E-mail de ajuste precisa ter observação");
    }

    if (email.event === "recusado") {
      assert.ok(searchable.includes("rejeitada") || searchable.includes("recusada"), "E-mail de recusa precisa indicar recusa");
      assert.ok(searchable.includes("motivo") || searchable.includes("solicitacao recusada"), "E-mail de recusa precisa ter motivo");
    }

    indexRows.push(`
      <tr>
        <td>${email.profile}</td>
        <td>${email.event}</td>
        <td>${email.subject}</td>
        <td><a href="./${fileName}" target="_blank">Abrir e-mail</a></td>
      </tr>
    `);
  }

  const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Preview dos e-mails - Solicitações de acesso</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f4f6fb;color:#011848;padding:32px}
    h1{margin-bottom:8px}
    p{color:#475569}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 16px 42px rgba(1,24,72,.12)}
    th,td{padding:14px 16px;border-bottom:1px solid #e5eaf3;text-align:left;font-size:14px}
    th{background:#011848;color:#fff}
    a{color:#ef0001;font-weight:800}
  </style>
</head>
<body>
  <h1>Preview dos e-mails de solicitação de acesso</h1>
  <p>Caixa fake: ${fakeInbox}</p>
  <p>Total validado: ${captured.length} e-mails</p>
  <table>
    <thead>
      <tr>
        <th>Perfil</th>
        <th>Tipo de e-mail</th>
        <th>Assunto</th>
        <th>Preview</th>
      </tr>
    </thead>
    <tbody>
      ${indexRows.join("\n")}
    </tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, "index.html"), indexHtml, "utf-8");
  fs.writeFileSync(path.join(outputDir, "emails.json"), JSON.stringify(captured, null, 2), "utf-8");

  console.log(`[EMAIL PREVIEW] OK - ${captured.length} e-mails gerados e validados.`);
  console.log(`[EMAIL PREVIEW] Abra: ${path.join(outputDir, "index.html")}`);
}

main().catch((error) => {
  console.error("[EMAIL PREVIEW] ERRO:", error);
  process.exitCode = 1;
});
