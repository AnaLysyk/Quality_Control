const nodemailer = require("nodemailer");

async function main() {
  const required = [
    "EMAIL_SMTP_HOST",
    "EMAIL_SMTP_PORT",
    "EMAIL_SMTP_USER",
    "EMAIL_SMTP_PASS",
    "EMAIL_FROM",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    console.error("[SMTP TEST] Variáveis ausentes:", missing.join(", "));
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: Number(process.env.EMAIL_SMTP_PORT || 587),
    secure: String(process.env.EMAIL_SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
  });

  console.log("[SMTP TEST] Verificando conexão...");
  await transporter.verify();
  console.log("[SMTP TEST] Conexão SMTP OK.");

  const to = process.env.TEST_EMAIL_TO || process.env.EMAIL_SMTP_USER;

  console.log("[SMTP TEST] Enviando e-mail para:", to);

  const result = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `Teste SMTP Quality Control - ${new Date().toISOString()}`,
    text: "Teste direto de SMTP do Quality Control.",
    html: `
      <h2>Teste SMTP Quality Control</h2>
      <p>Se você recebeu este e-mail, o SMTP está funcionando.</p>
      <p>${new Date().toISOString()}</p>
    `,
  });

  console.log("[SMTP TEST] Enviado com sucesso.");
  console.log(result);
}

main().catch((error) => {
  console.error("[SMTP TEST] Falhou:");
  console.error(error);
  process.exit(1);
});
