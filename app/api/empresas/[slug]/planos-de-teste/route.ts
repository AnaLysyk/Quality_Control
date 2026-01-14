import { NextResponse } from "next/server";

import { getClientQaseSettings } from "@/lib/qaseConfig";
import { QaseClient, QaseError } from "@/lib/qaseSdk";

type PlanResponse = {
  id: string;
  name: string;
  scope: string;
  tests: number;
  createdAt: string;
  risk: "alto" | "medio" | "baixo";
  link: string;
};

type RouteContext = { params: Promise<{ slug?: string }> };

const sanitizeEnvValue = (value: string | null | undefined, fallback = "") => {
  if (!value) return fallback;
  const cleaned = value.replace(/\r?\n/g, "").trim();
  return cleaned || fallback;
};

const FALLBACK_TOKEN = sanitizeEnvValue(process.env.QASE_TOKEN || process.env.QASE_API_TOKEN);
const PROJECT_MAP: Record<string, string> = {
  griaule: sanitizeEnvValue(process.env.QASE_PROJECT_CODE || process.env.QASE_PROJECT),
};

const QASE_APP_URL = sanitizeEnvValue(
  process.env.QASE_APP_URL || process.env.NEXT_PUBLIC_QASE_APP_URL,
  "https://app.qase.io",
);

const FALLBACK_PLANS: PlanResponse[] = [
  {
    id: "plan-aceitacao",
    name: "Plano de Aceitacao",
    scope: "Plano generico",
    tests: 48,
    createdAt: "2025-12-20",
    risk: "medio",
    link: "https://qase.io/plan/acceptance",
  },
  {
    id: "plan-regressao",
    name: "Plano de Regressao",
    scope: "Plano generico",
    tests: 72,
    createdAt: "2025-12-15",
    risk: "alto",
    link: "https://qase.io/plan/regression",
  },
  {
    id: "plan-smoke",
    name: "Plano Smoke",
    scope: "Plano generico",
    tests: 28,
    createdAt: "2025-12-10",
    risk: "baixo",
    link: "https://qase.io/plan/smoke",
  },
];

const FALLBACK_TOTAL_TESTS = FALLBACK_PLANS.reduce((sum, plan) => sum + plan.tests, 0);

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
};

const toStringValue = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const toNumberValue = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (Array.isArray(value)) return value.length;
  }
  return null;
};

const formatIsoDate = (value: unknown): string => {
  const str = toStringValue(value);
  if (!str) return new Date().toISOString().slice(0, 10);
  const timestamp = Date.parse(str);
  if (!Number.isNaN(timestamp)) {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
  return str;
};

const deriveRisk = (raw: Record<string, unknown>, tests: number): "alto" | "medio" | "baixo" => {
  const explicitRisk = toStringValue(raw["risk"] ?? raw["priority"] ?? raw["importance"])
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (explicitRisk === "alto" || explicitRisk === "alta" || explicitRisk === "high") return "alto";
  if (explicitRisk === "medio" || explicitRisk === "medium" || explicitRisk === "moderado") return "medio";
  if (explicitRisk === "baixo" || explicitRisk === "baixa" || explicitRisk === "low") return "baixo";

  if (tests >= 70) return "alto";
  if (tests >= 40) return "medio";
  return "baixo";
};

const normalizePlan = (entry: Record<string, unknown>, projectCode: string): PlanResponse | null => {
  const idSource = toStringValue(entry["id"] ?? entry["plan_id"] ?? entry["code"] ?? entry["uid"]);
  if (!idSource) return null;

  const name =
    toStringValue(entry["title"] ?? entry["name"] ?? entry["summary"]) ??
    `Plano ${idSource}`;

  const scope =
    toStringValue(
      entry["scope"] ??
        entry["description"] ??
        entry["details"] ??
        entry["suite"] ??
        entry["suite_name"] ??
        entry["root_suite_name"],
    ) ??
    "Sem escopo";

  const statsRecord = asRecord(entry["statistics"]);
  const statsValues = statsRecord
    ? [statsRecord["cases_total"], statsRecord["casesTotal"], statsRecord["total_cases"], statsRecord["total"]]
    : [];

  const tests = toNumberValue(
    entry["cases_count"],
    entry["casesCount"],
    entry["tests"],
    entry["cases_total"],
    entry["count_cases"],
    entry["countCases"],
    ...statsValues,
    entry["cases"],
  ) ?? 0;

  const createdAt = formatIsoDate(
    entry["created_at"] ?? entry["created"] ?? entry["createdAt"] ?? entry["created_date"],
  );

  const risk = deriveRisk(entry, tests);

  const linkFromApi = toStringValue(
    entry["link"] ??
      entry["url"] ??
      entry["web_url"] ??
      entry["public_url"] ??
      entry["html_url"] ??
      entry["reference_url"],
  );
  const baseUrl = QASE_APP_URL.endsWith("/") ? QASE_APP_URL.slice(0, -1) : QASE_APP_URL;
  const link = linkFromApi ?? `${baseUrl}/project/${encodeURIComponent(projectCode)}/plan/${encodeURIComponent(idSource)}`;

  return {
    id: idSource,
    name,
    scope,
    tests,
    createdAt,
    risk,
    link,
  };
};

const buildFallback = (slug: string): PlanResponse[] =>
  FALLBACK_PLANS.map((plan, index) => ({
    ...plan,
    id: `${slug}-${plan.id}-${index}`,
    scope: `${plan.scope} · ${slug}`,
  }));

export async function GET(_: Request, context: RouteContext) {
  const { slug: rawSlug } = await context.params;
  const slug = toStringValue(rawSlug)?.toLowerCase();

  if (!slug) {
    return NextResponse.json(
      { plans: [], totalTests: 0, error: "Slug da empresa nao informado." },
      { status: 200 },
    );
  }

  const clientSettings = await getClientQaseSettings(slug);
  const projectCode = clientSettings?.projectCode ?? PROJECT_MAP[slug];
  const token = clientSettings?.token ?? FALLBACK_TOKEN;

  if (!projectCode) {
    return NextResponse.json(
      {
        plans: buildFallback(slug),
        totalTests: FALLBACK_TOTAL_TESTS,
        error: "Projeto Qase nao configurado para esta empresa.",
      },
      { status: 200 },
    );
  }

  if (!token) {
    return NextResponse.json(
      {
        plans: buildFallback(slug),
        totalTests: FALLBACK_TOTAL_TESTS,
        error: "QASE_TOKEN ausente.",
      },
      { status: 200 },
    );
  }

  try {
    const client = new QaseClient({ token });
    const response = await client.listPlans(projectCode, { limit: 200 });
    const entities = response.result?.entities ?? [];

    const plans = entities
      .map((entry) => (entry ? normalizePlan(asRecord(entry) ?? {}, projectCode) : null))
      .filter((plan): plan is PlanResponse => plan !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const totalTests = plans.reduce((sum, plan) => sum + plan.tests, 0);

    if (!plans.length) {
      return NextResponse.json({ plans: buildFallback(slug), totalTests: FALLBACK_TOTAL_TESTS }, { status: 200 });
    }

    return NextResponse.json({ plans, totalTests }, { status: 200 });
  } catch (error) {
    const message = error instanceof QaseError ? error.message : "Erro ao consultar planos no Qase.";
    console.error(`[QASE][PLANS] Falha ao buscar planos para ${slug}:`, error);
    return NextResponse.json(
      {
        plans: buildFallback(slug),
        totalTests: FALLBACK_TOTAL_TESTS,
        error: message,
      },
      { status: 200 },
    );
  }
}
