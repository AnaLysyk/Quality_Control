import { mapClient, hasQaseTokenConfigured, hasJiraTokenConfigured } from "@/admin/clients/companyMapper";

// Simula exatamente o shape que app/api/companies/route.ts (Etapa 2.2 +
// correções) devolve para o GET: snake_case, sem tokens crus, com
// hasQaseToken/hasJiraToken booleanos.
function apiRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cmp-a",
    name: "Empresa A",
    slug: "empresa-a",
    active: true,
    tax_id: "12.345.678/0001-90",
    logo_url: "/images/empresa-a.png",
    integration_mode: "manual",
    qase_project_code: "QA1",
    qase_project_codes: ["QA1", "QA2"],
    ...overrides,
  };
}

describe("app/admin/clients/companyMapper.ts - Correção 1 (compatibilidade sem tokens crus)", () => {
  it("empresa com Qase configurado continua mostrando o badge correto (via hasQaseToken)", () => {
    const client = mapClient(apiRow({ hasQaseToken: true }));
    expect(client.hasQaseToken).toBe(true);
    expect(hasQaseTokenConfigured(client)).toBe(true);
  });

  it("empresa SEM Qase configurado não mostra o badge", () => {
    const client = mapClient(apiRow({ hasQaseToken: false }));
    expect(hasQaseTokenConfigured(client)).toBe(false);
  });

  it("empresa com Jira configurado continua mostrando o badge correto (via hasJiraToken)", () => {
    const client = mapClient(apiRow({ hasJiraToken: true }));
    expect(client.hasJiraToken).toBe(true);
    expect(hasJiraTokenConfigured(client)).toBe(true);
  });

  it("empresa SEM Jira configurado não mostra o badge", () => {
    const client = mapClient(apiRow({ hasJiraToken: false }));
    expect(hasJiraTokenConfigured(client)).toBe(false);
  });

  it("nenhum token é retornado: qaseToken/jiraApiToken sempre null, mesmo se a API mandar (defensivo)", () => {
    const client = mapClient(
      apiRow({
        hasQaseToken: true,
        hasJiraToken: true,
        // mesmo que algo malformado tentasse mandar um token de volta, o
        // mapper nunca lê row.qase_token/row.integrations para preencher
        // qaseToken/jiraApiToken -- ele ignora esses campos por completo.
        qase_token: "nao-deveria-ser-lido",
        integrations: [{ type: "QASE", config: { token: "nao-deveria-ser-lido" } }],
      }),
    );
    expect(client.qaseToken).toBeNull();
    expect(client.jiraApiToken).toBeNull();
  });

  it("nenhuma tela depende de qase_token ou integrations[].config.token: removê-los do payload não muda o resultado do mapeamento", () => {
    const withLegacyFields = mapClient(
      apiRow({
        hasQaseToken: true,
        qase_token: "segredo-presente",
        integrations: [{ type: "QASE", config: { token: "segredo-presente" } }],
      }),
    );
    const withoutLegacyFields = mapClient(apiRow({ hasQaseToken: true }));

    expect(withLegacyFields.hasQaseToken).toBe(withoutLegacyFields.hasQaseToken);
    expect(withLegacyFields.qaseToken).toBe(withoutLegacyFields.qaseToken);
  });

  it("campos não sensíveis continuam mapeados (compatibilidade geral da tela)", () => {
    const client = mapClient(apiRow());
    expect(client.id).toBe("cmp-a");
    expect(client.name).toBe("Empresa A");
    expect(client.slug).toBe("empresa-a");
    expect(client.taxId).toBe("12.345.678/0001-90");
    expect(client.logoUrl).toBe("/images/empresa-a.png");
    expect(client.qaseProjectCode).toBe("QA1");
    expect(client.qaseProjectCodes).toEqual(["QA1", "QA2"]);
  });

  it("hasQaseTokenConfigured/hasJiraTokenConfigured tratam ausência do campo como false (fail-closed)", () => {
    expect(hasQaseTokenConfigured(null)).toBe(false);
    expect(hasQaseTokenConfigured({})).toBe(false);
    expect(hasJiraTokenConfigured(null)).toBe(false);
    expect(hasJiraTokenConfigured({})).toBe(false);
  });
});
