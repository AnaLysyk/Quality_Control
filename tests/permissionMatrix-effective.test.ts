import { resolveEffectivePermissionMatrix } from "../lib/permissionMatrix";

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
});
