import { AUTOMATION_CASES } from "@/data/automationCases";

describe("automation cases catalog", () => {
  it("includes the new Testing Company automation coverage cases", () => {
    const ids = new Set(AUTOMATION_CASES.map((item) => item.id));

    expect(ids.has("case-qc-automation-fab-menu")).toBe(true);
    expect(ids.has("case-qc-automation-breadcrumb-back")).toBe(true);
    expect(ids.has("case-qc-automation-cards-width")).toBe(true);
    expect(ids.has("case-qc-automation-detail-actions")).toBe(true);
  });

  it("keeps the new automation cases scoped to Testing Company", () => {
    const automationCases = AUTOMATION_CASES.filter((item) =>
      [
        "case-qc-automation-fab-menu",
        "case-qc-automation-breadcrumb-back",
        "case-qc-automation-cards-width",
        "case-qc-automation-detail-actions",
      ].includes(item.id),
    );

    expect(automationCases).toHaveLength(4);
    expect(automationCases.every((item) => item.companyScope === "testing-company")).toBe(true);
  });
});
