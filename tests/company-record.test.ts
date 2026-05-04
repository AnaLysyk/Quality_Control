import { buildCompanyUpdatePatch, mapCompanyRecord } from "@/lib/companyRecord";

describe("companyRecord persistence helpers", () => {
  it("preserves saved integrations from the integrations array when saving unrelated company details", () => {
    const current = {
      id: "cmp-1",
      name: "Empresa Base",
      company_name: "Empresa Base",
      slug: "empresa-base",
      qase_project_codes: null,
      qase_token: null,
      jira_base_url: null,
      jira_email: null,
      jira_api_token: null,
      integration_mode: "qase",
      integrations: [
        {
          type: "QASE",
          config: {
            token: "qase-secret",
            projects: ["MIR", "PRINT"],
            validationStatus: "active",
            isValid: true,
            isActive: true,
          },
        },
        {
          type: "JIRA",
          config: {
            baseUrl: "https://empresa.atlassian.net",
            email: "jira@empresa.com",
            apiToken: "jira-secret",
          },
        },
      ],
    };

    const result = buildCompanyUpdatePatch(
      {
        name: "Empresa Atualizada",
        company_name: "Empresa Atualizada",
        phone: "+55 11 4000-9999",
      },
      current,
    );

    expect(result.patch.name).toBe("Empresa Atualizada");
    expect(result.patch.phone).toBe("+55 11 4000-9999");
    expect(result.patch.qase_token).toBe("qase-secret");
    expect(result.patch.qase_project_code).toBe("MIR");
    expect(result.patch.qase_project_codes).toEqual(["MIR", "PRINT"]);
    expect(result.patch.jira_base_url).toBe("https://empresa.atlassian.net");
    expect(result.patch.jira_email).toBe("jira@empresa.com");
    expect(result.patch.jira_api_token).toBe("jira-secret");
    expect(result.patch.integrations).toHaveLength(2);
  });

  it("clears both current and legacy integration fields when all integrations are removed", () => {
    const current = {
      id: "cmp-2",
      name: "Empresa Base",
      company_name: "Empresa Base",
      slug: "empresa-base",
      qase_project_code: "MIR",
      qase_project_codes: ["MIR", "PRINT"],
      qase_token: "qase-secret",
      jira_base_url: "https://empresa.atlassian.net",
      jira_email: "jira@empresa.com",
      jira_api_token: "jira-secret",
      integration_mode: "qase",
      integrations: [
        {
          type: "QASE",
          config: {
            token: "qase-secret",
            projects: ["MIR", "PRINT"],
          },
        },
        {
          type: "JIRA",
          config: {
            baseUrl: "https://empresa.atlassian.net",
            email: "jira@empresa.com",
            apiToken: "jira-secret",
          },
        },
      ],
    };

    const result = buildCompanyUpdatePatch(
      {
        integration_mode: "manual",
        qase_project_codes: [],
      },
      current,
      { clearAllIntegrations: true },
    );

    expect(result.patch.qase_project_code).toBeNull();
    expect(result.patch.qase_project_codes).toEqual([]);
    expect(result.patch.qase_token).toBeNull();
    expect(result.patch.jira_base_url).toBeNull();
    expect(result.patch.jira_email).toBeNull();
    expect(result.patch.jira_api_token).toBeNull();
    expect(result.patch.integration_mode).toBe("manual");
    expect(result.patch.integration_type).toBe("manual");
    expect(result.patch.integrations).toEqual([]);
  });

  it("maps a legacy Qase project into qase_project_codes for older company records", () => {
    const mapped = mapCompanyRecord({
      id: "cmp-3",
      name: "Empresa Legada",
      company_name: "Empresa Legada",
      slug: "empresa-legada",
      qase_project_code: "legacy",
      qase_project_codes: null,
      qase_token: "qase-secret",
    });

    expect(mapped.qase_project_code).toBe("LEGACY");
    expect(mapped.qase_project_codes).toEqual(["LEGACY"]);
    expect(mapped.has_qase_token).toBe(true);
  });

  it("persists notifications_fanout_enabled when explicitly changed", () => {
    const current = {
      id: "cmp-4",
      name: "Empresa Fanout",
      company_name: "Empresa Fanout",
      slug: "empresa-fanout",
      notifications_fanout_enabled: true,
    };

    const disabledResult = buildCompanyUpdatePatch(
      {
        name: "Empresa Fanout",
        notifications_fanout_enabled: false,
      },
      current,
    );

    expect(disabledResult.patch.notifications_fanout_enabled).toBe(false);

    const enabledResult = buildCompanyUpdatePatch(
      {
        name: "Empresa Fanout",
        notifications_fanout_enabled: true,
      },
      { ...current, notifications_fanout_enabled: false },
    );

    expect(enabledResult.patch.notifications_fanout_enabled).toBe(true);
  });

  it("defaults notifications_fanout_enabled to true when missing", () => {
    const mapped = mapCompanyRecord({
      id: "cmp-5",
      name: "Empresa Sem Campo",
      company_name: "Empresa Sem Campo",
      slug: "empresa-sem-campo",
    });

    expect(mapped.notifications_fanout_enabled).toBe(true);
  });
});
