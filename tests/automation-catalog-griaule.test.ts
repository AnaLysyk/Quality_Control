import {
  AUTOMATION_ENVIRONMENTS,
  getAutomationEnvironmentVariables,
  getDefaultAutomationEnvironmentId,
} from "@/data/automationCatalog";
import { AUTOMATION_API_PRESETS, AUTOMATION_COMPANY_TOOLS, getDefaultAutomationApiPreset } from "@/data/automationIde";
import griauleDocs from "@/data/company-docs-griaule.json";

describe("Griaule automation catalog", () => {
  it("defaults Griaule users to the homologation API host", () => {
    expect(getDefaultAutomationEnvironmentId("griaule")).toBe("griaule-hml-api-146");
    expect(getDefaultAutomationEnvironmentId("testing-company")).toBe("qc-local");
  });

  it("ships the Griaule homologation environments with non-secret defaults", () => {
    const environments = AUTOMATION_ENVIRONMENTS.filter((environment) => environment.id.startsWith("griaule-hml-"));

    expect(environments.map((environment) => environment.baseUrl)).toEqual(
      expect.arrayContaining([
        "http://172.16.1.146:8100",
        "http://172.16.1.146:8128",
        "http://172.16.1.201:8100",
      ]),
    );

    for (const environment of environments) {
      const passwordVariable = getAutomationEnvironmentVariables(environment.id).find((variable) => variable.key === "smartPassword");
      expect(passwordVariable?.value).toBe("");
    }
  });

  it("exposes executable SMART presets and tools", () => {
    expect(getDefaultAutomationApiPreset("griaule")?.id).toBe("griaule-token-credentials");

    expect(AUTOMATION_API_PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining([
        "griaule-token-credentials",
        "griaule-ping",
        "rfb-cpf",
        "processo-by-id",
        "griaule-process-filter-valid-cpf",
      ]),
    );

    const tokenTool = AUTOMATION_COMPANY_TOOLS.find((tool) => tool.id === "griaule-token");
    expect(tokenTool?.method).toBe("POST");
    expect(tokenTool?.pathTemplate).toBe("/api/tokens");
    expect(tokenTool?.fields.map((field) => field.id)).toEqual(expect.arrayContaining(["smartUser", "smartPassword"]));
  });

  it("documents the operational handoff without embedding shared passwords", () => {
    const doc = griauleDocs.docs.find((item) => item.id === "doc-griaule-smart-operador-homologacao");
    const category = griauleDocs.categories.find((item) => item.id === "cat-griaule-smart-operador");

    expect(category?.slug).toBe("smart-operador");
    expect(doc?.status).toBe("published");
    expect(JSON.stringify(doc)).toContain("http://172.16.1.146:8100/swagger-ui.html#/");
    expect(JSON.stringify(doc)).toContain("SC_BIOMETRICS_API_PASSWORD");
  });
});
