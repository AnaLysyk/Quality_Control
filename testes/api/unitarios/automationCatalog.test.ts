import { AUTOMATION_DOMAINS } from "../../../data/automationCatalog";

describe("automationCatalog", () => {
  it("should have valid catalog", () => {
    // Check if the exported structure is defined
    expect(AUTOMATION_DOMAINS).toBeDefined();
  });
});
