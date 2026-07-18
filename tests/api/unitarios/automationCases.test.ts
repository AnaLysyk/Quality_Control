import { AUTOMATION_CASES } from "../../../database/repositories/automationCases";

describe("automationCases", () => {
  it("should have valid export or data", () => {
    expect(AUTOMATION_CASES).toBeDefined();
    expect(Array.isArray(AUTOMATION_CASES)).toBe(true);
  });
});

