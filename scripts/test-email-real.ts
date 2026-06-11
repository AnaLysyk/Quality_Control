import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

process.env.FORCE_EMAIL_SEND = "true";
delete process.env.EMAIL_CAPTURE_MODE;
delete process.env.EMAIL_CAPTURE_FILE;

async function main() {
  const { emailService } = await import("../lib/email");

  const to = process.env.TEST_EMAIL_TO;

  if (!to) {
    throw new Error("Defina TEST_EMAIL_TO com o e-mail que deve receber o teste.");
  }

  console.log("[EMAIL TEST] Enviando e-mail real para:", to);
  console.log("[EMAIL TEST] SMTP HOST:", process.env.EMAIL_SMTP_HOST ? "configurado" : "vazio");
  console.log("[EMAIL TEST] SMTP USER:", process.env.EMAIL_SMTP_USER ? "configurado" : "vazio");
  console.log("[EMAIL TEST] EMAIL FROM:", process.env.EMAIL_FROM ? "configurado" : "vazio");
  console.log("[EMAIL TEST] FORCE_EMAIL_SEND:", process.env.FORCE_EMAIL_SEND);
  console.log("[EMAIL TEST] EMAIL_CAPTURE_MODE:", process.env.EMAIL_CAPTURE_MODE ?? "desligado");

  const sent = await emailService.sendAccessApprovedEmail(to, {
    name: "Ana Teste Manual",
    login: "ana.teste.manual",
    tempPassword: "SenhaTeste123!",
    profileType: "Suporte técnico",
    companySlug: null,
  });

  console.log("[EMAIL TEST] Resultado:", sent ? "ENVIADO" : "NÃO ENVIADO");

  if (!sent) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[EMAIL TEST] ERRO:", error);
  process.exitCode = 1;
});
