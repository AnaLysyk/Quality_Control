import {
  DEFAULT_CONTEXTUAL_DASHBOARD_FILTERS,
  buildDashboardAggregate,
  buildDashboardInsights,
  composeDashboardWidgets,
  filterDashboardSignals,
  type DashboardSignal,
} from "@/lib/dashboard/contextual";

const baseSignal: DashboardSignal = {
  id: "s1",
  type: "run",
  title: "Run critica",
  companySlug: "griaule",
  companyName: "Griaule",
  application: "Quality Control",
  module: "Runs",
  status: "failed",
  owner: "Sem responsavel",
  severity: "critical",
  priority: "P0",
  runCode: "RUN-1",
  defectCode: "",
  updatedAtIso: new Date().toISOString(),
};

describe("contextual dashboard composer", () => {
  it("filters by selected company, module and actionable flags", () => {
    const signals: DashboardSignal[] = [
      baseSignal,
      {
        ...baseSignal,
        id: "s2",
        type: "defect",
        companySlug: "testing-company",
        companyName: "Testing Company",
        module: "Defeitos",
        status: "resolved",
        owner: "Ana",
        severity: "low",
        priority: "P3",
      },
    ];

    const filtered = filterDashboardSignals(signals, {
      ...DEFAULT_CONTEXTUAL_DASHBOARD_FILTERS,
      companySlugs: ["griaule"],
      modules: ["Runs"],
      onlyWithoutOwner: true,
    });

    expect(filtered).toEqual([baseSignal]);
  });

  it("composes comparison and risk widgets only when data supports them", () => {
    const aggregate = buildDashboardAggregate([
      baseSignal,
      {
        ...baseSignal,
        id: "s2",
        companySlug: "testing-company",
        companyName: "Testing Company",
        status: "blocked",
        severity: "high",
        priority: "P1",
      },
    ]);

    const widgets = composeDashboardWidgets({
      filters: DEFAULT_CONTEXTUAL_DASHBOARD_FILTERS,
      aggregate,
      selectedCompanyCount: 2,
    }).map((widget) => widget.id);

    expect(widgets).toContain("company_comparison");
    expect(widgets).toContain("risk_ranking");
    expect(widgets).not.toContain("defects");
  });

  it("creates insights from real risk signals without inventing empty cards", () => {
    const emptyAggregate = buildDashboardAggregate([]);
    expect(buildDashboardInsights({ aggregate: emptyAggregate, selectedCompanyCount: 1 })).toEqual([]);

    const aggregate = buildDashboardAggregate([baseSignal]);
    const insights = buildDashboardInsights({ aggregate, selectedCompanyCount: 1 });

    expect(insights.some((insight) => insight.id === "critical")).toBe(true);
    expect(insights.some((insight) => insight.id === "without-owner")).toBe(true);
  });
});

