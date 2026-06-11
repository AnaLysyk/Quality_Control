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
    const greeting = data.name ? `Olá, ${data.name}!` : "Olá!";
    const normalizedRole = String(data.profileType ?? "").trim().toLowerCase();

    const roleContent: Record<string, {
      label: string;
      subject: string;
      title: string;
      intro: string;
      accessContext: string;
      permissionsTitle: string;
      permissions: string[];
      nextSteps: string[];
      badge: string;
    }> = {
      empresa: {
        label: "Empresa",
        subject: "Empresa aprovada",
        title: "Bem-vindo(a) à Quality Control",
        intro: "Sua empresa foi aprovada na plataforma Quality Control.",
        accessContext: "Este acesso permite administrar a empresa dentro da plataforma e organizar os usuários vinculados a ela.",
        permissionsTitle: "Com este perfil de empresa, você pode:",
        permissions: [
          "Cadastrar usuários da própria empresa",
          "Gerenciar acessos dos colaboradores vinculados",
          "Acompanhar recursos e informações disponíveis para a empresa",
          "Permitir que a equipe da empresa utilize a plataforma conforme as permissões configuradas",
        ],
        nextSteps: [
          "Acesse a plataforma com o login informado",
          "Confira os dados da empresa",
          "Cadastre os usuários da própria empresa",
          "Oriente os colaboradores sobre o acesso à plataforma",
        ],
        badge: "Empresa aprovada",
      },
      company_access: {
        label: "Empresa",
        subject: "Empresa aprovada",
        title: "Bem-vindo(a) à Quality Control",
        intro: "Sua empresa foi aprovada na plataforma Quality Control.",
        accessContext: "Este acesso permite administrar a empresa dentro da plataforma e organizar os usuários vinculados a ela.",
        permissionsTitle: "Com este perfil de empresa, você pode:",
        permissions: [
          "Cadastrar usuários da própria empresa",
          "Gerenciar acessos dos colaboradores vinculados",
          "Acompanhar recursos e informações disponíveis para a empresa",
          "Permitir que a equipe da empresa utilize a plataforma conforme as permissões configuradas",
        ],
        nextSteps: [
          "Acesse a plataforma com o login informado",
          "Confira os dados da empresa",
          "Cadastre os usuários da própria empresa",
          "Oriente os colaboradores sobre o acesso à plataforma",
        ],
        badge: "Empresa aprovada",
      },
      company_user: {
        label: "Usuário da empresa",
        subject: "Acesso de usuário da empresa aprovado",
        title: "Seu acesso de usuário da empresa foi aprovado",
        intro: "Seu usuário foi aprovado para acessar a Quality Control vinculado à empresa.",
        accessContext: "Este acesso permite utilizar a plataforma dentro do contexto da empresa à qual seu usuário está vinculado.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acessar a plataforma com vínculo empresarial",
          "Utilizar os recursos liberados para sua empresa",
          "Acompanhar informações conforme suas permissões",
          "Solicitar suporte quando necessário",
        ],
        nextSteps: [
          "Acesse a plataforma com seu login",
          "Use a senha cadastrada na solicitação",
          "Confira seu perfil",
          "Troque a senha em Meu Perfil, caso queira",
        ],
        badge: "Usuário da empresa aprovado",
      },
      testing_company_user: {
        label: "Usuário Testing Company",
        subject: "Acesso Testing Company aprovado",
        title: "Seu acesso Testing Company foi aprovado",
        intro: "Seu acesso interno foi aprovado e vinculado automaticamente ao ambiente da Testing Company.",
        accessContext: "Este perfil é voltado para usuários internos da Testing Company, conforme as permissões liberadas para sua função.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acessar recursos internos da Testing Company",
          "Atuar nos fluxos liberados para seu perfil",
          "Acompanhar atividades e informações da plataforma",
          "Utilizar o ambiente conforme suas permissões internas",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confirme seus dados no perfil",
          "Utilize os recursos liberados para seu perfil",
          "Troque a senha em Meu Perfil, caso queira",
        ],
        badge: "Usuário TC aprovado",
      },
      leader_tc: {
        label: "Líder TC",
        subject: "Acesso de liderança aprovado",
        title: "Seu acesso de liderança foi aprovado",
        intro: "Seu perfil de Líder TC foi aprovado na plataforma Quality Control.",
        accessContext: "Este perfil possui permissões de acompanhamento e administração dos fluxos liberados para liderança.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acompanhar solicitações de acesso",
          "Aprovar, recusar ou solicitar ajustes quando permitido",
          "Gerenciar fluxos vinculados à operação",
          "Acessar recursos administrativos liberados para liderança",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confira as solicitações pendentes",
          "Revise os fluxos liberados para liderança",
          "Troque a senha em Meu Perfil, caso queira",
        ],
        badge: "Líder TC aprovado",
      },
      technical_support: {
        label: "Suporte técnico",
        subject: "Acesso de suporte técnico aprovado",
        title: "Seu acesso de suporte técnico foi aprovado",
        intro: "Seu perfil de suporte técnico foi aprovado na plataforma Quality Control.",
        accessContext: "Este perfil permite atuar nos fluxos operacionais e de suporte conforme as permissões liberadas.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acompanhar solicitações e atendimentos",
          "Apoiar usuários e empresas vinculadas",
          "Atuar em revisões permitidas para suporte técnico",
          "Utilizar recursos técnicos liberados para seu perfil",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confira as filas e solicitações disponíveis",
          "Atue apenas nos fluxos liberados para suporte técnico",
          "Troque a senha em Meu Perfil, caso queira",
        ],
        badge: "Suporte técnico aprovado",
      },
    };

    const contentByRole =
      roleContent[normalizedRole] ??
      {
        label: data.profileType ?? "Perfil aprovado",
        subject: "Acesso aprovado",
        title: "Seu acesso foi aprovado",
        intro: "Sua solicitação foi aprovada na plataforma Quality Control.",
        accessContext: "Este acesso permite utilizar a plataforma conforme as permissões vinculadas ao seu perfil.",
        permissionsTitle: "Com este perfil, você pode:",
        permissions: [
          "Acessar a plataforma",
          "Utilizar os recursos disponíveis para seu perfil",
          "Acompanhar informações conforme suas permissões",
        ],
        nextSteps: [
          "Acesse a plataforma",
          "Confira seus dados",
          "Troque a senha em Meu Perfil, caso queira",
        ],
        badge: "Acesso aprovado",
      };

    const companyLine = data.companySlug
      ? `<tr><td class="label">Empresa vinculada</td><td class="value">${data.companySlug}</td></tr>`
      : "";

    const passwordLabel = data.passwordFromRequest
      ? "Use a senha cadastrada no momento da solicitação"
      : data.tempPassword
        ? data.tempPassword
        : "Use a senha definida no cadastro";

    const permissionsHtml = contentByRole.permissions.map((item) => `<li>${item}</li>`).join("");
    const nextStepsHtml = contentByRole.nextSteps.map((item) => `<li>${item}</li>`).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${contentByRole.subject} - Quality Control</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#011848;background:#f4f6fb}
    .page{width:100%;padding:42px 12px;background:linear-gradient(135deg,#011848 0%,#eef2f8 48%,#ef0001 100%)}
    .card{max-width:780px;margin:0 auto;background:rgba(255,255,255,.98);border:1px solid rgba(1,24,72,.14);border-radius:26px;overflow:hidden;box-shadow:0 24px 70px rgba(1,24,72,.25)}
    .header{background:linear-gradient(135deg,#011848 0%,#142b63 48%,#ef0001 100%);color:#fff;padding:44px 42px;text-align:center}
    .brand{display:inline-block;margin:0 auto 14px;padding:8px 18px;border:1px solid rgba(255,255,255,.34);border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font-size:13px;font-weight:800;letter-spacing:.2px}
    .header h1{margin:0;font-size:28px;line-height:1.2}
    .header p{margin:10px 0 0;font-size:15px;opacity:.94}
    .content{padding:42px 46px 36px}
    .badge{display:inline-block;padding:8px 14px;border-radius:999px;background:#dcfce7;color:#166534;border:1px solid #bbf7d0;font-size:13px;font-weight:800;margin-bottom:18px}
    h2{margin:0 0 12px;color:#011848;font-size:23px;line-height:1.3}
    p{margin:0 0 16px;color:#475569;font-size:14px;line-height:1.75}
    .info{margin:24px 0;border:1px solid #d8dfeb;border-radius:18px;overflow:hidden;background:#f8fafc}
    .info table{width:100%;border-collapse:collapse}
    .info td{padding:15px 18px;border-bottom:1px solid #e5eaf3;font-size:14px;vertical-align:top}
    .info tr:last-child td{border-bottom:0}
    .label{width:34%;color:#64748b;font-weight:800}
    .value{color:#011848;font-weight:800;word-break:break-word}
    .box{margin:22px 0;padding:18px 20px;background:#f0f4ff;border:1px solid #d8dfeb;border-left:5px solid #011848;border-radius:16px;color:#27457d;font-size:13px;line-height:1.65}
    .box strong{color:#011848}
    .list{margin:10px 0 0;padding-left:20px;color:#27457d}
    .list li{margin:7px 0}
    .buttonWrap{text-align:center;margin:32px 0 12px}
    .button{display:inline-block;padding:16px 38px;border-radius:14px;background:linear-gradient(135deg,#011848 0%,#ef0001 100%);color:#fff!important;text-decoration:none;font-weight:900;font-size:15px;box-shadow:0 14px 28px rgba(239,0,1,.28)}
    .footer{padding:20px 28px 28px;text-align:center;color:#64748b;font-size:12px;background:#fff}
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div class="brand">Testing Company</div>
        <h1>Quality Control</h1>
        <p>${contentByRole.title}</p>
      </div>

      <div class="content">
        <span class="badge">✓ ${contentByRole.badge}</span>

        <h2>${greeting}</h2>

        <p>${contentByRole.intro}</p>
        <p>${contentByRole.accessContext}</p>

        <div class="info">
          <table>
            <tr><td class="label">Login cadastrado</td><td class="value">${data.login}</td></tr>
            <tr><td class="label">Senha</td><td class="value">${passwordLabel}</td></tr>
            <tr><td class="label">Perfil aprovado</td><td class="value">${contentByRole.label}</td></tr>
            ${companyLine}
          </table>
        </div>

        <div class="box">
          <strong>${contentByRole.permissionsTitle}</strong>
          <ul class="list">${permissionsHtml}</ul>
        </div>

        <div class="box">
          <strong>Próximos passos:</strong>
          <ul class="list">${nextStepsHtml}</ul>
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
        © ${new Date().getFullYear()} Testing Company • Quality Control.
      </div>
    </div>
  </div>
</body>
</html>`;

    const permissionsText = contentByRole.permissions.map((item) => `- ${item}`).join("\\n");
    const nextStepsText = contentByRole.nextSteps.map((item) => `- ${item}`).join("\\n");

    const text = `${greeting}

${contentByRole.title}

${contentByRole.intro}
${contentByRole.accessContext}

Login cadastrado: ${data.login}
Senha: ${passwordLabel}
Perfil aprovado: ${contentByRole.label}
${data.companySlug ? `Empresa vinculada: ${data.companySlug}` : ""}

${contentByRole.permissionsTitle}
${permissionsText}

Próximos passos:
${nextStepsText}

Acesse em: ${loginUrl}

Depois do primeiro acesso, você pode trocar a senha em Meu Perfil > Alterar Senha, caso queira.`;

    return this.sendEmail({
      to,
      subject: `${contentByRole.subject} - Quality Control`,
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
