export type AutomationCompanyScope = "all" | string;

const COMPANY_SCOPE_ALIASES: Record<"griaule" | "testing-company", string[]> = {
  griaule: ["griaule"],
  "testing-company": ["testing-company", "testing_company", "testingcompany", "testing company", "test-company"],
};

export function normalizeAutomationCompanyScope(rawValue: string | null | undefined): string | null {
  const normalized = rawValue?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "all") return "all";

  for (const [scope, aliases] of Object.entries(COMPANY_SCOPE_ALIASES) as Array<
    [keyof typeof COMPANY_SCOPE_ALIASES, string[]]
  >) {
    if (aliases.includes(normalized)) {
      return scope;
    }
  }

  return normalized;
}

export function matchesAutomationCompanyScope(scope: AutomationCompanyScope, activeCompanySlug: string | null | undefined) {
  if (scope === "all") return true;
  return normalizeAutomationCompanyScope(activeCompanySlug) === normalizeAutomationCompanyScope(scope);
}

export function isTestingCompanyScope(activeCompanySlug: string | null | undefined) {
  return normalizeAutomationCompanyScope(activeCompanySlug) === "testing-company";
}

export function isGriauleScope(activeCompanySlug: string | null | undefined) {
  return normalizeAutomationCompanyScope(activeCompanySlug) === "griaule";
}
