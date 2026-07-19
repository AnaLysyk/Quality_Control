describe("emailService templates", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
      NEXT_PUBLIC_SITE_URL: "https://qc.example.com/",
      EMAIL_LOGO_URL: "https://cdn.example.com/logo.png",
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  async function serviceWithSpy() {
    jest.doMock("nodemailer", () => ({
      __esModule: true,
      default: { createTransport: jest.fn() },
    }));
    const { emailService } = await import("@/backend/email");
    const send = jest.spyOn(emailService, "sendEmail").mockResolvedValue(true);
    return { emailService, send };
  }

  it("gera redefinição de senha com URL pública normalizada", async () => {
    const { emailService, send } = await serviceWithSpy();

    await expect(emailService.sendPasswordResetEmail("ana@example.com", "tok<&\"")).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: "ana@example.com",
      subject: "Redefinir senha - Quality Control",
      text: expect.stringContaining("https://qc.example.com/login/reset-password?token=tok<&\""),
      html: expect.stringContaining("tok&lt;&amp;&quot;"),
    }));
    expect(send.mock.calls[0][0].html).toContain("https://cdn.example.com/logo.png");
  });

  it("escapa nome, login e senha no e-mail de boas-vindas", async () => {
    const { emailService, send } = await serviceWithSpy();

    await emailService.sendWelcomeEmail(
      "novo@example.com",
      "ana<script>",
      "S&nha<123>",
      "Ana <Admin>",
    );

    const payload = send.mock.calls[0][0];
    expect(payload.subject).toBe("Seus dados de acesso - Quality Control");
    expect(payload.html).toContain("Ana &lt;Admin&gt;");
    expect(payload.html).toContain("ana&lt;script&gt;");
    expect(payload.html).toContain("S&amp;nha&lt;123&gt;");
    expect(payload.html).not.toContain("<script>");
    expect(payload.text).toContain("Ana <Admin>");
    expect(payload.text).toContain("https://qc.example.com/login");
  });

  it("usa saudação genérica quando não há nome", async () => {
    const { emailService, send } = await serviceWithSpy();

    await emailService.sendWelcomeEmail("novo@example.com", "novo", "Temp123", null);

    expect(send.mock.calls[0][0].html).toContain("<h2>Olá!</h2>");
    expect(send.mock.calls[0][0].text).toContain("Olá!");
  });
});
