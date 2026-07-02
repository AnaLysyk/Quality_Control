import { describe, expect, it } from "@jest/globals";

import { buildBrainNodeActions, resolveBrainAction } from "@/lib/brain/actions";
import { buildBrainSearchIndex, searchBrainIndex } from "@/lib/brain/searchIndex";

const baseAccess = {
  user: { id: "user-1", isGlobalAdmin: false },
  userAccess: {
    userId: "user-1",
    role: "testing_company_user",
    permissionRole: "testing_company_user",
    companyId: "company-1",
    companySlug: "testing-company",
    permissions: {
      brain: ["view", "read", "use", "view_external_sources", "use_qase_data"],
      qase: ["view", "view_cases"],
    },
  },
  hasGlobalVisibility: false,
  canManage: false,
  allowedCompanySlugs: new Set(["testing-company"]),
  allowedCompanyIds: new Set(["company-1"]),
} as any;

describe("Brain product contract", () => {
  it("ranks operational dashboard from synonyms", () => {
    const nodes = [
      {
        id: "module:operations",
        type: "Module",
        label: "Operacional",
        description: "Dashboard operacional e metricas",
        refType: "SystemModule",
        refId: "operations",
        metadata: { route: "/operacoes/dashboard", tags: ["operacional", "painel", "metricas"] },
        updatedAt: new Date(),
      },
      {
        id: "defect:1",
        type: "Defect",
        label: "Defeito em fluxo operacional",
        description: "Falha menor",
        refType: "Defect",
        refId: "1",
        metadata: {},
        updatedAt: new Date(),
      },
    ];

    const index = buildBrainSearchIndex(nodes as any, []);
    const results = searchBrainIndex(index, "onde esta o painel operacional", { limit: 2 });

    expect(results[0].nodeId).toBe("module:operations");
    expect(results[0].matchedBy).toEqual(expect.arrayContaining(["label"]));
  });

  it("keeps external token permissions separate from user actions", async () => {
    const node = {
      id: "qase:case:123",
      type: "QaseCase",
      label: "Caso Qase 123",
      refType: "QaseCase",
      refId: "123",
      metadata: {
        provider: "qase",
        source: { type: "integration", provider: "qase", externalId: "123" },
        availableActions: ["open_external", "summarize", "update_case"],
      },
    } as any;

    const actions = buildBrainNodeActions(node);
    expect(actions.map((action) => action.id)).toContain("update_case");

    const resolution = await resolveBrainAction({
      node,
      actionId: "update_case",
      access: baseAccess,
      audit: false,
    });

    expect(resolution.allowed).toBe(false);
    if (!resolution.allowed) {
      expect(resolution.missingPermissions).toContain("qase:update_case");
    }
  });
});
