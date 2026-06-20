export type ApprovedAccessEmailData = {
  name: string;
  profileLabel: string;
  username: string;
  email: string;
  phone?: string | null;
  jobRole?: string | null;
  title?: string | null;
  description?: string | null;
  accessUrl: string;
  statusUrl: string;
};

export function buildApprovedAccessEmail(data: ApprovedAccessEmailData) {
  const phone = data.phone || "Não informado";
  const jobRole = data.jobRole || "Não informado";
  const title = data.title || "Solicitação de acesso";
  const description = data.description || "Não informado";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Solicitação de acesso aprovada</title>
</head>

<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#061a44;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f7fb;padding:24px 0;">
    <tr>
      <td align="center">

        <table width="680" cellpadding="0" cellspacing="0" role="presentation" style="width:680px;max-width:680px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dbe3f0;box-shadow:0 20px 60px rgba(1,24,72,0.16);">

          <tr>
            <td align="center" style="padding:38px 32px 32px;background:linear-gradient(135deg,#001b4d 0%,#191b4d 48%,#d90416 100%);color:#ffffff;">

              <div style="margin:0 auto 16px;width:82px;height:92px;">
                <div style="width:44px;height:24px;background:#ff0015;transform:skew(32deg);margin-left:28px;border-radius:2px;"></div>
                <div style="width:70px;height:24px;background:#e30613;transform:skew(-32deg) rotate(-55deg);margin-top:18px;margin-left:4px;border-radius:2px;"></div>
              </div>

              <h1 style="margin:0;font-size:42px;line-height:1.1;font-weight:900;letter-spacing:-1px;color:#ffffff;">
                Quality Control
              </h1>

              <p style="margin:10px 0 0;font-size:18px;line-height:1.4;color:#ffffff;">
                Solicitação de acesso aprovada
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 40px 16px;background:#ffffff;">

              <div style="text-align:center;margin-bottom:20px;">
                <span style="display:inline-block;padding:12px 22px;border-radius:999px;background:#dcfce7;color:#047857;font-size:17px;font-weight:800;">
                  ✓ ${escapeHtml(data.profileLabel)} aprovado
                </span>
              </div>

              <h2 style="margin:0;text-align:center;font-size:34px;line-height:1.2;font-weight:900;color:#061a44;">
                Solicitação de acesso aprovada
              </h2>

              <div style="width:76px;height:2px;background:#e5eaf3;margin:20px auto 24px;">
                <div style="width:22px;height:2px;background:#e30613;margin:0 auto;"></div>
              </div>

              <p style="margin:0;text-align:center;font-size:20px;line-height:1.5;font-weight:800;color:#061a44;">
                Olá, <span style="color:#e30613;">${escapeHtml(data.name)}</span>!
              </p>

              <p style="margin:14px 0 0;text-align:center;font-size:15px;line-height:1.7;color:#24365f;">
                Seu acesso como ${escapeHtml(data.profileLabel.toLowerCase())} foi aprovado na plataforma Quality Control.<br />
                Este perfil permite atuar nos fluxos operacionais conforme as permissões liberadas.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:34px;border:1px solid #dbe3f0;border-radius:20px;padding:22px;background:#ffffff;">
                <tr>
                  <td colspan="2" style="padding-bottom:18px;">
                    <h3 style="margin:0;font-size:21px;font-weight:900;color:#061a44;">
                      <span style="color:#e30613;">▣</span> Resumo da aprovação
                    </h3>
                  </td>
                </tr>

                ${infoRow("Perfil aprovado", data.profileLabel, "E-mail", data.email)}
                ${infoRow("Usuário gerado", data.username, "Cargo", jobRole)}
                ${infoRow("Nome completo", data.name, "Título da solicitação", title)}
                ${infoRow("Telefone", phone, "Descrição final", description)}
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:24px;">
                <tr>
                  <td width="50%" style="padding-right:10px;">
                    <a href="${escapeHtml(data.accessUrl)}" style="display:block;text-align:center;text-decoration:none;padding:18px 20px;border-radius:14px;background:linear-gradient(135deg,#001b4d 0%,#e30613 100%);color:#ffffff;font-size:16px;font-weight:900;">
                      🔒 Acessar plataforma →
                    </a>
                  </td>

                  <td width="50%" style="padding-left:10px;">
                    <a href="${escapeHtml(data.statusUrl)}" style="display:block;text-align:center;text-decoration:none;padding:17px 20px;border-radius:14px;background:#ffffff;border:2px solid #e30613;color:#061a44;font-size:16px;font-weight:900;">
                      📋 Consultar status da solicitação
                    </a>
                  </td>
                </tr>
              </table>

              <div style="margin-top:24px;padding:16px 18px;border-radius:16px;background:#f8fbff;border:1px solid #dbe3f0;color:#24365f;font-size:14px;line-height:1.6;">
                <strong style="color:#061a44;">ℹ</strong>
                Se você não solicitou este acesso ou acredita que este e-mail foi enviado por engano,
                entre em contato com o administrador da sua empresa.
              </div>

            </td>
          </tr>

          <tr>
            <td style="padding:22px 34px;background:#001b4d;color:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle;width:230px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">
                          <div style="display:inline-block;width:32px;height:40px;">
                            <div style="width:20px;height:10px;background:#ff0015;transform:skew(32deg);margin-left:10px;border-radius:1px;"></div>
                            <div style="width:32px;height:10px;background:#e30613;transform:skew(-32deg) rotate(-55deg);margin-top:8px;margin-left:0;border-radius:1px;"></div>
                          </div>
                        </td>
                        <td style="vertical-align:middle;font-size:18px;font-weight:900;color:#ffffff;">
                          Quality Control
                        </td>
                      </tr>
                    </table>
                  </td>

                  <td style="vertical-align:middle;border-left:2px solid #e30613;padding-left:22px;font-size:13px;line-height:1.5;color:#dbeafe;">
                    Plataforma de gestão da qualidade<br />
                    e suporte operacional.
                  </td>

                  <td align="right" style="vertical-align:middle;font-size:13px;line-height:1.5;color:#ffffff;">
                    Segurança <span style="color:#e30613;">•</span>
                    Conformidade <span style="color:#e30613;">•</span>
                    Confiança
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function infoRow(leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
  return `
<tr>
  <td width="50%" style="padding:6px 8px 6px 0;">
    ${infoCard(leftLabel, leftValue)}
  </td>
  <td width="50%" style="padding:6px 0 6px 8px;">
    ${infoCard(rightLabel, rightValue)}
  </td>
</tr>
`;
}

function infoCard(label: string, value: string) {
  return `
<div style="min-height:72px;padding:14px 16px;border-radius:14px;background:#f8fbff;border:1px solid #e5eaf3;">
  <div style="font-size:11px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:#061a44;margin-bottom:7px;">
    ${escapeHtml(label)}
  </div>
  <div style="font-size:15px;font-weight:700;line-height:1.4;color:#061a44;">
    ${escapeHtml(value)}
  </div>
</div>
`;
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
