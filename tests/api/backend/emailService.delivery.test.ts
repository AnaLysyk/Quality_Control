import type { EmailOptions } from "@/backend/email";

const ORIGINAL_ENV = process.env;

async function loadService(options?: {
  sendMail?: jest.Mock;
  appendFileSync?: jest.Mock;
  mkdirSync?: jest.Mock;
}) {
  jest.resetModules();
  const sendMail = options?.sendMail ?? jest.fn().mockResolvedValue({ messageId: "msg-1" });
  const appendFileSync = options?.appendFileSync ?? jest.fn();
  const mkdirSync = options?.mkdirSync ?? jest.fn();

  jest.doMock("nodemailer", () => ({
    __esModule: true,
    default: { createTransport: jest.fn(() => ({ sendMail })) },
  }));
  jest.doMock("fs", () => ({ appendFileSync, mkdirSync }));

  const module = await import("@/backend/email");
  return { service: module.emailService, sendMail, appendFileSync, mkdirSync };
}

describe("emailService delivery", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.EMAIL_CAPTURE_MODE;
    delete process.env.ACCESS_REQUEST_EMAIL_BYPASS;
    delete process.env.EMAIL_CAPTURE_FILE;
    delete process.env.FORCE_EMAIL_SEND;
    delete process.env.EMAIL_SMTP_HOST;
    delete process.env.EMAIL_SMTP_PORT;
    delete process.env.EMAIL_SMTP_SECURE;
    delete process.env.EMAIL_SMTP_USER;
    delete process.env.EMAIL_SMTP_PASS;
    delete process.env.EMAIL_FROM;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const email: EmailOptions = {
    to: "ana@example.com",
    subject: "Assunto",
    html: "<p>Olá</p>",
    text: "Olá",
  };

  it("captura o e-mail em arquivo fora de produção", async () => {
    process.env.NODE_ENV = "test";
    process.env.EMAIL_CAPTURE_MODE = "file";
    process.env.EMAIL_CAPTURE_FILE = "tmp/outbox.jsonl";
    const { service, appendFileSync, mkdirSync, sendMail } = await loadService();

    await expect(service.sendEmail(email)).resolves.toBe(true);
    expect(mkdirSync).toHaveBeenCalledWith("tmp", { recursive: true });
    expect(appendFileSync).toHaveBeenCalledWith(
      "tmp/outbox.jsonl",
      expect.stringContaining('"to":"ana@example.com"'),
      "utf8",
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("simula envio em desenvolvimento quando não forçado", async () => {
    process.env.NODE_ENV = "development";
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const { service, sendMail } = await loadService();

    await expect(service.sendEmail(email)).resolves.toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Email simulado"));
    expect(sendMail).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("retorna falso e avisa uma vez sem SMTP em produção", async () => {
    process.env.NODE_ENV = "production";
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { service } = await loadService();

    await expect(service.sendEmail(email)).resolves.toBe(false);
    await expect(service.sendEmail(email)).resolves.toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it("envia por SMTP com opções seguras", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_SMTP_HOST = "smtp.example.com";
    process.env.EMAIL_SMTP_PORT = "465";
    process.env.EMAIL_SMTP_USER = "user";
    process.env.EMAIL_SMTP_PASS = "pass";
    process.env.EMAIL_FROM = "qc@example.com";
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const sendMail = jest.fn().mockResolvedValue({ messageId: "smtp-1" });
    const { service } = await loadService({ sendMail });

    await expect(service.sendEmail(email)).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "qc@example.com",
      to: email.to,
      subject: email.subject,
      disableFileAccess: true,
      disableUrlAccess: true,
      textEncoding: "base64",
    }));
    log.mockRestore();
  });

  it("retorna falso quando o transporte falha", async () => {
    process.env.NODE_ENV = "production";
    process.env.EMAIL_SMTP_HOST = "smtp.example.com";
    process.env.EMAIL_SMTP_USER = "user";
    process.env.EMAIL_SMTP_PASS = "pass";
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { service } = await loadService({ sendMail: jest.fn().mockRejectedValue(new Error("offline")) });

    await expect(service.sendEmail(email)).resolves.toBe(false);
    expect(error).toHaveBeenCalledWith("Falha ao enviar email:", expect.any(Error));
    error.mockRestore();
  });
});
