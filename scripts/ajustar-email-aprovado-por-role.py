from pathlib import Path
import re

path = Path("lib/email.ts")
content = path.read_text(encoding="utf-8")

new_method = r'''async sendAccessApprovedEmail(
    to: string,
    data: {
      name?: string | null;
      login: string;
      tempPassword?: string | null;
      passwordFromRequest?: boolean;
      profileType?: string | null;
      companySlug?: string | null;
    },
  ): Promise<boolean> {
    const loginUrl = `${this.resolvePublicBaseUrl()}/login`;
    const greeting = data.name ? `Olá, ${data.name}!` : 'Olá!';

    const normalizedRole = String(data.profileType ?? "").trim().toLowerCase();

    const roleContent: Record<string, {
      label: string;
      title: string;
      intro: string;
      permissions: string[];
      badge: string;
    }> = {
      empresa: {
        label: "Empresa",
        title: "Bem-vindo(a) à Quality Control",
        intro: "Sua empresa foi aprovada na plataforma. Agora você pode acessar o ambiente e organizar os usuários da sua própria empresa.",
        permissions: [
          "Cadastrar usuários da própria empresa",
          "Gerenciar acessos dos colaboradores vinculados",
          "Acompanhar informações e recursos disponíveis para a empresa",
          "Utilizar a plataforma com o perfil institucional aprovado",
        ],
        badge: "Empresa aprovada",
      },
      company_access: {
        label: "Empresa",
        title: "Bem-vindo(a) à Quality Control",
        intro: "Sua empresa foi aprovada na plataforma. Agora você pode acessar o ambiente e organizar os usuários da sua própria empresa.",
        permissions: [
          "Cadastrar usuários da própria empresa",
          "Gerenciar acessos dos colaboradores vinculados",
          "Acompanhar informações e recursos disponíveis para a empresa",
          "Utilizar a plataforma com o perfil institucional aprovado",
        ],
        badge: "Empresa aprovada",
      },
      company_user: {
        label: "Usuário da empresa",
        title: "Seu acesso de empresa foi aprovado",
        intro: "Seu usuário foi aprovado para acessar a Quality Control vinculado à empresa.",
        permissions: [
          "Acessar a plataforma com vínculo empresarial",
          "Utilizar os recursos liberados para sua empresa",
          "Acompanhar informações conforme suas permissões",
          "Solicitar suporte quando necessário",
        ],
        badge: "Usuário da empresa aprovado",
      },
      testing_company_user: {
        label: "Usuário Testing Company",
        title: "Seu acesso Testing Company foi aprovado",
        intro: "Seu acesso interno foi aprovado. Você foi vinculado automaticamente ao ambiente da Testing Company.",
        permissions: [
          "Acessar recursos internos da Testing Company",
          "Atuar nos fluxos liberados para seu perfil",
          "Acompanhar atividades e informações da plataforma",
          "Utilizar o ambiente conforme suas permissões internas",
        ],
        badge: "Usuário TC aprovado",
      },
      leader_tc: {
        label: "Líder TC",
        title: "Seu acesso de liderança foi aprovado",
        intro: "Seu perfil de liderança foi aprovado. Você poderá acompanhar e administrar fluxos conforme as permissões de Líder TC.",
        permissions: [
          "Acompanhar solicitações de acesso",
          "Aprovar, recusar ou solicitar ajustes quando permitido",
          "Gerenciar fluxos vinculados à operação",
          "Acessar recursos administrativos liberados para liderança",
        ],
        badge: "Líder TC aprovado",
      },
      technical_support: {
        label: "Suporte técnico",
        title: "Seu acesso de suporte técnico foi aprovado",
        intro: "Seu perfil de suporte técnico foi aprovado. Você poderá atuar nos fluxos operacionais e de suporte da plataforma.",
        permissions: [
          "Acompanhar solicitações e atendimentos",
          "Apoiar usuários e empresas vinculadas",
          "Atuar em revisões permitidas para suporte técnico",
          "Utilizar recursos técnicos liberados para seu perfil",
        ],
        badge: "Suporte técnico aprovado",
      },
    };

    const contentByRole =
      roleContent[normalizedRole] ??
      {
        label: data.profileType ?? "Perfil aprovado",
        title: "Seu acesso foi aprovado",
        intro: "Sua solicitação foi aprovada. Agora você já pode acessar a plataforma Quality Control.",
        permissions: [
          "Acessar a plataforma",
          "Utilizar os recursos disponíveis para seu perfil",
          "Acompanhar informações conforme suas permissões",
        ],
        badge: "Acesso aprovado",
      };

    const companyLine = data.companySlug
      ? `<tr><td class="label">Empresa</td><td class="value">${data.companySlug}</td></tr>`
      : "";

    const passwordLine = data.passwordFromRequest
      ? "Use a senha cadastrada no momento da solicitação"
      : "Use a senha enviada pela equipe responsável";

    const tempPasswordLine = !data.passwordFromRequest && data.tempPassword
      ? `<tr><td class="label">Senha</td><td class="value">${data.tempPassword}</td></tr>`
      : `<tr><td class="label">Senha</td><td class="value">${passwordLine}</td></tr>`;

    const permissionsHtml = contentByRole.permissions.map((item) => `<li>${item}</li>`).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Acesso aprovado - Quality Control</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#011848;background:#f4f6fb}
    .page{width:100%;padding:32px 12px;background:linear-gradient(135deg,#011848 0%,#f4f6fb 52%,#ef0001 100%)}
    .card{max-width:660px;margin:0 auto;background:rgba(255,255,255,.97);border:1px solid rgba(1,24,72,.12);border-radius:26px;overflow:hidden;box-shadow:0 24px 70px rgba(1,24,72,.24)}
    .header{background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#fff;padding:38px 32px;text-align:center}
    .logo{width:74px;height:74px;margin:0 auto 16px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);display:table}
    .logo span{display:table-cell;vertical-align:middle;font-size:28px;font-weight:800;letter-spacing:-1px}
    .header h1{margin:0;font-size:26px;line-height:1.2}
    .header p{margin:8px 0 0;font-size:14px;opacity:.92}
    .content{padding:34px 32px 28px}
    .badge{display:inline-block;padding:8px 14px;border-radius:999px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;font-size:13px;font-weight:800;margin-bottom:18px}
    h2{margin:0 0 12px;color:#011848;font-size:22px;line-height:1.3}
    p{margin:0 0 16px;color:#475569;font-size:14px;line-height:1.75}
    .info{margin:24px 0;border:1px solid #d8dfeb;border-radius:18px;overflow:hidden;background:#f8fafc}
    .info table{width:100%;border-collapse:collapse}
    .info td{padding:14px 16px;border-bottom:1px solid #e5eaf3;font-size:14px;vertical-align:top}
    .info tr:last-child td{border-bottom:0}
    .label{width:34%;color:#64748b;font-weight:800}
    .value{color:#011848;font-weight:800;word-break:break-word}
    .box{margin:22px 0;padding:18px 20px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:16px;color:#27457d;font-size:13px;line-height:1.65}
    .box strong{color:#011848}
    .permissions{margin:10px 0 0;padding-left:20px;color:#27457d}
    .permissions li{margin:6px 0}
    .buttonWrap{text-align:center;margin:30px 0 12px}
    .button{display:inline-block;padding:15px 30px;border-radius:14px;background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#fff!important;text-decoration:none;font-weight:900;font-size:14px;box-shadow:0 12px 24px rgba(239,0,1,.22)}
    .footer{padding:20px 28px 28px;text-align:center;color:#64748b;font-size:12px;background:#fff}
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div class="logo"><span>QC</span></div>
        <h1>Quality Control</h1>
        <p>${contentByRole.title}</p>
      </div>

      <div class="content">
        <span class="badge">✓ ${contentByRole.badge}</span>

        <h2>${greeting}</h2>

        <p>${contentByRole.intro}</p>

        <div class="info">
          <table>
            <tr><td class="label">Login</td><td class="value">${data.login}</td></tr>
            ${tempPasswordLine}
            <tr><td class="label">Perfil</td><td class="value">${contentByRole.label}</td></tr>
            ${companyLine}
          </table>
        </div>

        <div class="box">
          <strong>O que você pode fazer com este perfil:</strong>
          <ul class="permissions">${permissionsHtml}</ul>
        </div>

        <div class="box">
          A senha deste acesso é a senha definida no momento da solicitação.
          Depois do primeiro acesso, você pode trocar a senha em
          <strong>Meu Perfil → Alterar Senha</strong>, caso queira.
        </div>

        <div class="buttonWrap">
          <a href="${loginUrl}" class="button">Acessar o sistema</a>
        </div>

        <p style="text-align:center;font-size:12px;color:#64748b;margin-top:18px;">
          Link direto: ${loginUrl}
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

    const permissionsText = contentByRole.permissions.map((item) => `- ${item}`).join("\n");

    const text = `${greeting}

${contentByRole.title}

${contentByRole.intro}

Login: ${data.login}
Senha: ${passwordLine}
Perfil: ${contentByRole.label}
${data.companySlug ? `Empresa: ${data.companySlug}` : ""}

O que você pode fazer com este perfil:
${permissionsText}

Acesse em: ${loginUrl}

Depois do primeiro acesso, você pode trocar a senha em Meu Perfil > Alterar Senha, caso queira.`;

    return this.sendEmail({
      to,
      subject: `${contentByRole.title} - Quality Control`,
      html,
      text,
    });
  }

  '''

content = re.sub(
    r"async sendAccessApprovedEmail\([\s\S]*?\n  async sendAccessRejectedEmail\(",
    new_method + "async sendAccessRejectedEmail(",
    content,
)

path.write_text(content, encoding="utf-8")
