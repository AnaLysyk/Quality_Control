import {
  buildApplicationMatchKeys,
  classifyRunStatus,
  computePassRate,
  computeRunStats,
  matchesApplicationKeys,
  normalizeOperationModuleKey,
} from "@/runs/operationsWorkspace";

describe("operationsWorkspace helpers", () => {
  it("normalizes module aliases to canonical keys", () => {
    expect(normalizeOperationModuleKey("aplicacoes")).toBe("applications");
    expect(normalizeOperationModuleKey("planos-de-teste")).toBe("test-plans");
    expect(normalizeOperationModuleKey("suporte")).toBe("support");
    expect(normalizeOperationModuleKey("metricas")).toBe("metrics");
    expect(normalizeOperationModuleKey("qualquer-coisa")).toBe("dashboard");
  });

  it("matches applications by slug, name and project code", () => {
    const keys = buildApplicationMatchKeys({
      slug: "testing-company-app",
      name: "Testing Company App",
      projectCode: "TCAPP",
      companySlug: "testing-company",
    });

    expect(matchesApplicationKeys(keys, ["testing-company-app"])).toBe(true);
    expect(matchesApplicationKeys(keys, ["Testing Company App"])).toBe(true);
    expect(matchesApplicationKeys(keys, ["tcapp"])).toBe(true);
    expect(matchesApplicationKeys(keys, ["outra-app", "TCAPP"])).toBe(true);
    expect(matchesApplicationKeys(keys, ["outra-app", "OUTRO"])).toBe(false);
  });

  it("aggregates run stats and pass rate with qase style fields", () => {
    const stats = computeRunStats({
      passed: 8,
      failed: 1,
      blocked: 1,
      untested: 2,
      in_progress: 1,
    });

    expect(stats).toEqual({
      pass: 8,
      fail: 1,
      blocked: 1,
      notRun: 3,
      total: 13,
    });
    expect(computePassRate(stats)).toBe(62);
  });

  it("classifies run statuses with the same buckets used by the workspace", () => {
    expect(classifyRunStatus("running")).toBe("in_progress");
    expect(classifyRunStatus("done")).toBe("completed");
    expect(classifyRunStatus("blocked")).toBe("blocked");
    expect(classifyRunStatus("failed")).toBe("at_risk");
    expect(classifyRunStatus("pending")).toBe("pending");
    expect(classifyRunStatus("")).toBe("unknown");
  });
});
