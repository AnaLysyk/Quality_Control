describe("emailService access request templates", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
      NEXT_PUBLIC_SITE_URL: "https://qc.example.com/",
      EMAIL_LOGO_URL: "https://cdn.example.com/logo.png",
      ACCESS_REQUEST_LOOKUP_CODE_TTL_MINUTES: "12",
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

  it("builds a company access request and hides sensitive company fields", async () => {
    const { emailService, send } = await serviceWithSpy();

    await emailService.sendAccessRequestReceivedEmail("ana@example.com", {
      name: "Ana <QA>",
      accessKey: "KEY<&>",
      email: "ana@example.com",
      username: "ana.qa",
      phone: "48999999999",
      passwordDefined: true,
      profileType: "company_user",
      companyName: "Empresa Ágil",
      title: "Acesso",
      description: "Descrição <script>",
      status: "Em análise",
      companyDetails: {
        cnpj: "12.345.678/0001-99",
        companyTaxId: "duplicado",
        city: "Florianópolis",
        activities: ["QA", "Dev"],
        password: "segredo",
      },
    });

    const payload = send.mock.calls[0][0];
    expect(payload.subject).toBe("Solicitação de acesso recebida - Quality Control");
    expect(payload.html).toContain("EMPRESA ÁGIL");
    expect(payload.html).toContain("KEY&lt;&amp;&gt;");
    expect(payload.html).toContain("Florianópolis");
    expect(payload.html).not.toContain("segredo");
    expect(payload.html).not.toContain("duplicado");
    expect(payload.html).not.toContain("<script>");
    expect(payload.text).toContain("Pessoa / empresa: Ana <QA> / EMPRESA ÁGIL");
    expect(payload.text).toContain("https://qc.example.com/login/access-request/status?key=KEY%3C%26%3E");
  });

  it.each([
    ["empresa", "Empresa aprovada"],
    ["company_user", "Usuário da empresa aprovado"],
    ["testing_company_user", "Usuário TC aprovado"],
    ["leader_tc", "Líder TC aprovado"],
    ["technical_support", "Administrador aprovado"],
    ["custom_role", "Acesso aprovado"],
  ])("builds approved email for role %s", async (profileType, badge) => {
    const { emailService, send } = await serviceWithSpy();

    await emailService.sendAccessApprovedEmail("user@example.com", {
      name: "Pessoa",
      login: "pessoa.login",
      tempPassword: profileType === "leader_tc" ? "Temp<123>" : null,
      passwordFromRequest: true,
      profileType,
      companyName: profileType === "empresa" || profileType === "company_user" ? "Cliente A" : null,
    });

    const payload = send.mock.calls[0][0];
    expect(payload.html).toContain(badge);
    expect(payload.html).toContain("pessoa.login");
    expect(payload.text).toContain("https://qc.example.com/login");
    if (profileType === "leader_tc") expect(payload.html).toContain("Temp&lt;123&gt;");
  });

  it("builds rejected email with and without status link", async () => {
    const { emailService, send } = await serviceWithSpy();

    await emailService.sendAccessRejectedEmail("ana@example.com", {
      name: "Ana",
      comment: "Documento <inválido>",
      accessKey: "ABC123",
    });
    expect(send.mock.calls[0][0].html).toContain("Documento &lt;inválido&gt;");
    expect(send.mock.calls[0][0].html).toContain("status?key=ABC123");

    await emailService.sendAccessRejectedEmail("semnome@example.com", {});
    expect(send.mock.calls[1][0].text).toContain("Recusado por dados incompatíveis");
    expect(send.mock.calls[1][0].html).not.toContain("Consultar solicitação");
  });

  it("builds adjustment email with escaped multiline observation and configured ttl", async () => {
    const { emailService, send } = await serviceWithSpy();

    await emailService.sendAccessAdjustmentEmail("ana@example.com", {
      name: "Ana",
      accessKey: "KEY<12>",
      comment: "Corrigir nome\nEnviar documento <novo>",
    });

    const payload = send.mock.calls[0][0];
    expect(payload.subject).toBe("Ajuste necessário na sua solicitação - Quality Control");
    expect(payload.html).toContain("Corrigir nome<br>Enviar documento &lt;novo&gt;");
    expect(payload.html).toContain("KEY&lt;12&gt;");
    expect(payload.html).toContain("12 minutos");
    expect(payload.text).toContain("https://qc.example.com/login/access-request");
  });
});
