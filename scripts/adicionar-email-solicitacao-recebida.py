from pathlib import Path

path = Path("lib/email.ts")
content = path.read_text(encoding="utf-8")

if "async sendAccessRequestReceivedEmail(" not in content:
    marker = "  async sendAccessApprovedEmail("
    method = r'''  async sendAccessRequestReceivedEmail(
    to: string,
    data: {
      name?: string | null;
      accessKey: string;
      email: string;
      phone?: string | null;
      profileType?: string | null;
      companyName?: string | null;
      title?: string | null;
      description?: string | null;
      status?: string | null;
    },
  ): Promise<boolean> {
    const statusUrl = `${this.resolvePublicBaseUrl()}/login/access-request/status?key=${data.accessKey}`;
    const greeting = data.name ? `Olá, ${data.name}!` : "Olá!";
    const profileLabel = String(data.profileType ?? "Perfil solicitado").replaceAll("_", " ");
    const companyLine = data.companyName
      ? `<tr><td class="label">Empresa</td><td class="value">${data.companyName}</td></tr>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Solicitação de acesso recebida - Quality Control</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#011848;background:#f4f6fb}
    .page{width:100%;padding:40px 12px;background:linear-gradient(135deg,#011848 0%,#eef2f8 48%,#ef0001 100%)}
    .card{max-width:760px;margin:0 auto;background:#fff;border:1px solid rgba(1,24,72,.12);border-radius:26px;overflow:hidden;box-shadow:0 24px 70px rgba(1,24,72,.24)}
    .header{background:linear-gradient(135deg,#011848 0%,#142b63 46%,#ef0001 100%);color:#fff;padding:44px 40px;text-align:center}
    .brand{display:inline-block;margin:0 auto 14px;padding:8px 16px;border:1px solid rgba(255,255,255,.34);border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font-size:13px;font-weight:800}
    .header h1{margin:0;font-size:26px;line-height:1.2}
    .header p{margin:8px 0 0;font-size:14px;opacity:.92}
    .content{padding:42px 44px 34px}
    .badge{display:inline-block;padding:8px 14px;border-radius:999px;background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;font-size:13px;font-weight:800;margin-bottom:18px}
    h2{margin:0 0 12px;color:#011848;font-size:22px;line-height:1.3}
    p{margin:0 0 16px;color:#475569;font-size:14px;line-height:1.75}
    .info{margin:24px 0;border:1px solid #d8dfeb;border-radius:18px;overflow:hidden;background:#f8fafc}
    .info table{width:100%;border-collapse:collapse}
    .info td{padding:14px 16px;border-bottom:1px solid #e5eaf3;font-size:14px;vertical-align:top}
    .info tr:last-child td{border-bottom:0}
    .label{width:34%;color:#64748b;font-weight:800}
    .value{color:#011848;font-weight:800;word-break:break-word}
    .box{margin:22px 0;padding:18px 20px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:16px;color:#27457d;font-size:13px;line-height:1.65}
    .buttonWrap{text-align:center;margin:30px 0 12px}
    .button{display:inline-block;padding:16px 36px;border-radius:14px;background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#fff!important;text-decoration:none;font-weight:900;font-size:15px;box-shadow:0 14px 28px rgba(239,0,1,.28)}
    .footer{padding:20px 28px 28px;text-align:center;color:#64748b;font-size:12px;background:#fff}
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

        <h2>${greeting}</h2>

        <p>
          Recebemos sua solicitação de acesso. Ela está em análise pela equipe responsável.
          Você receberá uma atualização quando for aprovada, recusada ou quando precisar de ajuste.
        </p>

        <div class="info">
          <table>
            <tr><td class="label">Nome</td><td class="value">${data.name ?? "-"}</td></tr>
            <tr><td class="label">E-mail</td><td class="value">${data.email}</td></tr>
            <tr><td class="label">Telefone</td><td class="value">${data.phone ?? "-"}</td></tr>
            <tr><td class="label">Perfil solicitado</td><td class="value">${profileLabel}</td></tr>
            ${companyLine}
            <tr><td class="label">Código de acesso</td><td class="value">${data.accessKey}</td></tr>
          </table>
        </div>

        <div class="box">
          Guarde este código. Ele será usado junto com seu nome e e-mail para consultar o andamento da solicitação.
        </div>

        <div class="buttonWrap">
          <a href="${statusUrl}" class="button">Consultar solicitação</a>
        </div>

        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">
          Link direto: ${statusUrl}
        </p>
      </div>

      <div class="footer">
        E-mail automático. Não responda.<br>
        © ${new Date().getFullYear()} Quality Control.
      </div>
    </div>
  </div>
</body>
</html>`;

    const text = `${greeting}

Recebemos sua solicitação de acesso.

Nome: ${data.name ?? "-"}
E-mail: ${data.email}
Telefone: ${data.phone ?? "-"}
Perfil solicitado: ${profileLabel}
${data.companyName ? `Empresa: ${data.companyName}` : ""}
Código de acesso: ${data.accessKey}

Consulte sua solicitação em:
${statusUrl}

Guarde este código para acompanhar sua solicitação.`;

    return this.sendEmail({
      to,
      subject: "Solicitação de acesso recebida - Quality Control",
      html,
      text,
    });
  }

'''
    content = content.replace(marker, method + marker)

path.write_text(content, encoding="utf-8")
