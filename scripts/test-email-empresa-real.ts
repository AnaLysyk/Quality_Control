import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env" });

delete process.env.EMAIL_CAPTURE_MODE;
delete process.env.EMAIL_CAPTURE_FILE;
process.env.FORCE_EMAIL_SEND = "true";

async function main() {
  const { emailService } = await import("../lib/email");

  const to = process.env.TEST_EMAIL_TO ?? "ana.testing.company@gmail.com";

  console.log("[EMAIL EMPRESA] Enviando e-mail real para:", to);
  console.log("[EMAIL EMPRESA] FORCE_EMAIL_SEND:", process.env.FORCE_EMAIL_SEND);
  console.log("[EMAIL EMPRESA] EMAIL_CAPTURE_MODE:", process.env.EMAIL_CAPTURE_MODE ?? "desligado");

  const sent = await emailService.sendAccessRequestReceivedEmail(to, {
    name: "Ana Empresa Teste",
    accessKey: "codigo-teste-empresa-123456",
    email: to,
    phone: "51999999999",
    profileType: "company_access",
    companyName: "Empresa Teste Manual",
    title: "Solicitação de cadastro de empresa",
    description: "Teste real de envio de e-mail para cadastro de empresa.",
    status: "pending",
  });

  console.log("[EMAIL EMPRESA] Resultado:", sent ? "ENVIADO" : "NÃO ENVIADO");

  if (!sent) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[EMAIL EMPRESA] ERRO:", error);
  process.exitCode = 1;
});
