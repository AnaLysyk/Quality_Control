import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { CompanyAccessError, assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { findLocalCompanyById, findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { getCompanyDefects } from "@/lib/quality";

const DAY_MS = 24 * 60 * 60 * 1000;
const SLA_MS = 48 * 60 * 60 * 1000;

type PeriodKey = "7d" | "30d" | "90d" | "all";

const PERIODS: Record<PeriodKey, { label: string; days: number | null }> = {
  "7d": { label: "7d", days: 7 },
  "30d": { label: "30d", days: 30 },
  "90d": { label: "90d", days: 90 },
  all: { label: "all", days: null },
};

type ExportDefect = {
  id?: string;
  title?: string;
  origin?: string;
  status?: string;
  openedAt?: string;
  closedAt?: string;
};

function toCsvLine(values: Array<string | number | null | undefined>) {
  return values
    .map((value) => {
      if (value == null) return "";
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/\"/g, "\"\"")}"`;
      }
      return text;
    })
    .join(",");
}

function resolvePeriod(raw: string | null | undefined) {
  const normalized = (raw ?? "30d").toLowerCase() as PeriodKey;
  return PERIODS[normalized] ?? PERIODS["30d"];
}

function filterDefectsByPeriod(defects: ExportDefect[], { days }: { days: number | null }) {
  if (days == null) return defects;
  const cutoff = Date.now() - days * DAY_MS;
  return defects.filter((defect) => {
    const openedAt = defect.openedAt ? Date.parse(defect.openedAt) : Number.NaN;
    return Number.isFinite(openedAt) && openedAt >= cutoff;
  });
}

function summarizeDefects(defects: ExportDefect[]) {
  const totalDefects = defects.length;
  const now = Date.now();
  const openDefects = defects.filter((defect) => (defect.status ?? "").toLowerCase() !== "done");
  const closedDefects = defects.filter((defect) => (defect.status ?? "").toLowerCase() === "done");

  const slaOverdue = openDefects.filter((defect) => {
    const opened = defect.openedAt ? Date.parse(defect.openedAt) : Number.NaN;
    return Number.isFinite(opened) && now - opened > SLA_MS;
  }).length;

  const mttrValues = closedDefects
    .map((defect) => {
      const opened = defect.openedAt ? Date.parse(defect.openedAt) : Number.NaN;
      const closed = defect.closedAt ? Date.parse(defect.closedAt) : Number.NaN;
      if (!Number.isFinite(opened) || !Number.isFinite(closed) || closed <= opened) {
        return null;
      }
      const hours = (closed - opened) / (60 * 60 * 1000);
      return Math.round(hours * 10) / 10;
    })
    .filter((value): value is number => value != null);

  const mttrAvg = mttrValues.length
    ? Math.round((mttrValues.reduce((acc, value) => acc + value, 0) / mttrValues.length) * 10) / 10
    : null;

  let qualityScore = 100;
  if (slaOverdue > 0) qualityScore -= slaOverdue * 10;
  if (mttrAvg != null && mttrAvg > 48) qualityScore -= 5;
  qualityScore = Math.max(0, Math.min(qualityScore, 100));

  return {
    qualityScore,
    totalDefects,
    openDefects: openDefects.length,
    slaOverdue,
    mttrAvg,
  };
}

function sanitizeForFilename(value: string) {
  return value.replace(/[^a-z0-9_.-]/gi, "_");
}

async function ensureCompanyAccess(slug: string) {
  const companyBySlug = await findLocalCompanyBySlug(slug).catch(() => null);
  if (companyBySlug) {
    return { company: companyBySlug } as const;
  }

  const companyById = await findLocalCompanyById(slug).catch(() => null);
  if (companyById) {
    return { company: companyById } as const;
  }

  return { error: NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 }) } as const;
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = (params?.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ error: "slug obrigatorio" }, { status: 400 });
  }

  const { company, error: companyError } = await ensureCompanyAccess(slug);
  if (companyError) return companyError;

  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    assertCompanyAccess(authUser, company.id);
  } catch (err) {
    if (err instanceof CompanyAccessError && company.slug && company.slug !== company.id) {
      try {
        assertCompanyAccess(authUser, company.slug);
      } catch (inner) {
        if (inner instanceof CompanyAccessError) {
          return NextResponse.json({ error: "Sem acesso a empresa" }, { status: 403 });
        }
        throw inner;
      }
    } else if (err instanceof CompanyAccessError) {
      return NextResponse.json({ error: "Sem acesso a empresa" }, { status: 403 });
    } else {
      throw err;
    }
  }

  const period = resolvePeriod(req.nextUrl.searchParams.get("period"));

  try {
    const defectsRaw = await getCompanyDefects(company.slug ?? slug, { periodDays: period.days });
    const defects = filterDefectsByPeriod(defectsRaw as ExportDefect[], period);
    const summary = summarizeDefects(defects);

    const lines: string[] = [];
    lines.push("company,period,quality_score,open_defects,total_defects,mttr_avg_hours,sla_overdue");
    lines.push(
      toCsvLine([
        company.slug ?? slug,
        period.label,
        summary.qualityScore,
        summary.openDefects,
        summary.totalDefects,
        summary.mttrAvg,
        summary.slaOverdue,
      ]),
    );
    lines.push("");
    lines.push("id,title,origin,status,opened_at,closed_at");

    defects.forEach((defect) => {
      lines.push(
        toCsvLine([
          defect.id ?? "",
          defect.title ?? "",
          defect.origin ?? "",
          defect.status ?? "",
          defect.openedAt ?? "",
          defect.closedAt ?? "",
        ]),
      );
    });

    const csv = `${lines.join("\n")}\n`;
    const headers = new Headers();
    headers.set("Content-Type", "text/csv; charset=utf-8");
    const safeName = sanitizeForFilename(company.slug ?? slug);
    headers.set("Content-Disposition", `attachment; filename="quality-${safeName}-${period.label}.csv"`);

    return new NextResponse(csv, { headers });
  } catch (error) {
    console.error("[api/empresas/quality/export] Failed to build CSV", error);
    return NextResponse.json({ error: "Erro ao gerar relatorio" }, { status: 500 });
  }
}
