export type AutomationCompanyScope = "all" | "griaule" | "testing-company";

const COMPANY_SCOPE_ALIASES: Record<Exclude<AutomationCompanyScope, "all">, string[]> = {
  griaule: ["griaule"],
  "testing-company": ["testing-company", "testing_company", "testingcompany", "testing company", "test-company"],
};

export function normalizeAutomationCompanyScope(rawValue: string | null | undefined): Exclude<AutomationCompanyScope, "all"> | null {
  const normalized = rawValue?.trim().toLowerCase();
  if (!normalized) return null;

  for (const [scope, aliases] of Object.entries(COMPANY_SCOPE_ALIASES) as Array<
    [Exclude<AutomationCompanyScope, "all">, string[]]
  >) {
    if (aliases.includes(normalized)) {
      return scope;
    }
  }

  return null;
}

export function matchesAutomationCompanyScope(scope: AutomationCompanyScope, activeCompanySlug: string | null | undefined) {
  if (scope === "all") return true;
  return normalizeAutomationCompanyScope(activeCompanySlug) === scope;
}

export function isTestingCompanyScope(activeCompanySlug: string | null | undefined) {
  return normalizeAutomationCompanyScope(activeCompanySlug) === "testing-company";
}

export function isGriauleScope(activeCompanySlug: string | null | undefined) {
  return normalizeAutomationCompanyScope(activeCompanySlug) === "griaule";
}
