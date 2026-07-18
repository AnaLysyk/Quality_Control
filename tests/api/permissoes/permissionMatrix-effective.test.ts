import { resolveEffectivePermissionMatrix } from "@/backend/permissionMatrix";

describe("resolveEffectivePermissionMatrix", () => {
  it("falls back to role defaults when the matrix is empty", () => {
    const matrix = resolveEffectivePermissionMatrix({
      permissions: {},
      role: "empresa",
    });

    expect(matrix.users).toEqual(["view", "create"]);
    expect(matrix.ai).toEqual(["view", "use"]);
  });

  it("keeps explicit permissions when the matrix already has actions", () => {
    const matrix = resolveEffectivePermissionMatrix({
      permissions: {
        tickets: ["view"],
      },
      role: "empresa",
    });

    expect(matrix).toEqual({
      tickets: ["view"],
    });
  });

  it("resolves full permissions for the existing leader_tc profile", () => {
    const matrix = resolveEffectivePermissionMatrix({
      permissionRole: "leader_tc",
    });

    expect(matrix.tickets).toContain("view_all");
    expect(matrix.users).toContain("delete");
    expect(matrix.audit).toContain("export");
  });
});

