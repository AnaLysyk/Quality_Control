import { AUTOMATION_CASES } from "../data/automationCases";

describe("automationCases", () => {
  it("should have valid export or data", () => {
    expect(AUTOMATION_CASES).toBeDefined();
    expect(Array.isArray(AUTOMATION_CASES)).toBe(true);
  });
});
