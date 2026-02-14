import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { CompanyAccessError, assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { findLocalCompanyById, findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { rateLimit } from "@/lib/rateLimit";
import {
  buildReleaseCsv,
  buildReleasePdf,
  loadReleaseExportContext,
  sanitizeForFilename,
  ReleaseExportError,
} from "@/lib/reporting/releaseExport";

type ExportFormat = "csv" | "pdf";

const DEFAULT_FORMAT: ExportFormat = "csv";

function normalizeFormat(raw: string | null | undefined): ExportFormat {
  if (!raw) return DEFAULT_FORMAT;
  const lowered = raw.trim().toLowerCase();
  return lowered === "pdf" ? "pdf" : "csv";
}

async function findCompanyBySlugOrId(slug: string) {
  const bySlug = await findLocalCompanyBySlug(slug).catch(() => null);
  if (bySlug) return bySlug;
  return findLocalCompanyById(slug).catch(() => null);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; releaseSlug: string }> },
) {
  const resolvedParams = await params;
  const companySlugParam = (resolvedParams?.slug ?? "").trim();
  const releaseSlugParam = (resolvedParams?.releaseSlug ?? "").trim();
  if (!companySlugParam || !releaseSlugParam) {
    return NextResponse.json({ error: "slug e releaseSlug obrigatorios" }, { status: 400 });
  }

  const company = await findCompanyBySlugOrId(companySlugParam);
  if (!company) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

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

  const limiterKey = `release-export:${authUser.id}:${company.id}`;
  const rateResult = await rateLimit(req, limiterKey, 10, 60);
  if (rateResult.limited) {
    return (
      rateResult.response ?? NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    );
  }

  let exportContext;
  try {
    exportContext = await loadReleaseExportContext(
      {
        id: company.id,
        slug: company.slug ?? company.id,
        name: company.name ?? company.company_name ?? company.slug ?? company.id,
        company_name: company.company_name ?? null,
      },
      releaseSlugParam,
    );
  } catch (error) {
    if (error instanceof ReleaseExportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const format = normalizeFormat(req.nextUrl.searchParams.get("format"));
  const safeCompany = sanitizeForFilename(
    exportContext.company.slug ?? exportContext.company.id ?? "company",
  );
  const safeRelease = sanitizeForFilename(exportContext.release.slug ?? releaseSlugParam);
  const filename = `${safeCompany}-${safeRelease}.${format}`;

  const headers = new Headers();
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  headers.set("Content-Type", format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8");

  try {
    const payload =
      format === "pdf" ? await buildReleasePdf(exportContext) : buildReleaseCsv(exportContext);
    const body = typeof payload === "string" ? payload : Buffer.from(payload);
    console.info("[release-export]", {
      companyId: company.id,
      companySlug: company.slug,
      release: exportContext.release.slug,
      format,
      actor: authUser.id ?? authUser.email ?? "anonymous",
    });
    return new NextResponse(body, { headers });
  } catch (error) {
    console.error("[api/empresas/release/export] Failed to export release", error);
    return NextResponse.json({ error: "Erro ao gerar relatorio" }, { status: 500 });
  }
}
