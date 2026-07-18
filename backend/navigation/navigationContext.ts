import type { NavModule } from "./navigationCatalog";

export type NavContext = {
  isCompanyContext: boolean;
  companySlug: string | null;
  activeModule: NavModule | null;
  segment: string | null;
};

const MODULE_PATTERNS: Array<{ pattern: RegExp; module: NavModule }> = [
  { pattern: /^\/admin\/(dashboard|test-metric|runs|operac)/, module: "operations" },
  { pattern: /^\/admin\/(access-requests)/, module: "requests" },
  { pattern: /^\/admin\/(clients|users)/, module: "companies" },
  { pattern: /^\/admin\/(defeitos|releases|casos)/, module: "quality" },
  { pattern: /^\/admin\/(support|chamados)/, module: "support" },
  { pattern: /^\/admin\/(audit-logs|logs)/, module: "operations" },
  { pattern: /^\/admin\/(brain)/, module: "brain" },
  { pattern: /^\/admin\/(users\/permissions|integrations|settings)/, module: "admin" },
  { pattern: /^\/automacoes/, module: "automation" },
  { pattern: /^\/(?:chat|conversas)/, module: "brain" },
  { pattern: /^\/kanban/, module: "operations" },
  { pattern: /^\/runs/, module: "quality" },
  { pattern: /^\/(?:documentos|documentacao)/, module: "documents" },
  { pattern: /^\/(?:chamados|meus-chamados)/, module: "support" },
  { pattern: /^\/(?:integrations|settings)/, module: "admin" },
  { pattern: /^(?:\/home|\/$)/, module: "home" },
];

const COMPANY_SEGMENT_MAP: Record<string, NavModule> = {
  dashboard: "operations",
  metrics: "operations",
  runs: "quality",
  "planos-de-teste": "quality",
  defeitos: "quality",
  releases: "quality",
  aplicacoes: "companies",
  chamados: "support",
  documentos: "documents",
  home: "home",
  admin: "admin",
};

export function detectNavContext(pathname: string): NavContext {
  // Company route: /empresas/[slug]/* or /{prefix}/{slug}/*
  const companyMatch = pathname.match(
    /^\/empresas\/([^/]+)(?:\/([^/]+))?/,
  );
  if (companyMatch) {
    const slug = companyMatch[1];
    const segment = companyMatch[2] ?? null;
    const activeModule = segment ? (COMPANY_SEGMENT_MAP[segment] ?? "companies") : "companies";
    return {
      isCompanyContext: true,
      companySlug: slug,
      activeModule,
      segment,
    };
  }

  // Global route
  for (const { pattern, module } of MODULE_PATTERNS) {
    if (pattern.test(pathname)) {
      return { isCompanyContext: false, companySlug: null, activeModule: module, segment: null };
    }
  }

  return { isCompanyContext: false, companySlug: null, activeModule: null, segment: null };
}

