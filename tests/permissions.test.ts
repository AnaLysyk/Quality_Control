import { can } from "@/permissions";

describe("permissions.can", () => {
  it("allows admin operations even when company is inactive", () => {
    expect(can("admin", "run", "create", { companyActive: false })).toBe(true);
  });

  it("denies non-admin operations when company is inactive", () => {
    expect(can("company", "defect", "create", { companyActive: false })).toBe(false);
    expect(can("user", "defect", "create", { companyActive: false })).toBe(false);
  });

  it("grants access when resource and action arrays contain an allowed combination", () => {
    expect(can("company", ["defect", "run"], ["linkRun", "linkDefect"], { companyActive: true })).toBe(true);
  });

  it("exposes run creation to user role", () => {
    expect(can("user", "run", "create", { companyActive: true })).toBe(true);
  });

  it("returns false for unknown resources", () => {
    expect(can("user", "unknown", "create", { companyActive: true })).toBe(false);
  });
});
