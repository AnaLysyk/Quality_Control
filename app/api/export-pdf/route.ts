import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { CompanyAccessError, assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { findLocalCompanyById, findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { rateLimit } from "@/lib/rateLimit";
import { buildDashboardSummary, resolveDashboardPeriod } from "@/lib/services/dashboardSummary";
import { buildDashboardSummaryPdf } from "@/lib/reporting/dashboardSummaryPdf";
import { sanitizeForFilename } from "@/lib/reporting/releaseExport";

export const runtime = "nodejs";

async function findCompanyBySlugOrId(slug: string) {
  const bySlug = await findLocalCompanyBySlug(slug).catch(() => null);
  if (bySlug) return bySlug;
  return findLocalCompanyById(slug).catch(() => null);
}

function resolveFileName(raw: string | null, fallback: string) {
  const base = raw ? raw.replace(/\.pdf$/i, "") : fallback;
  const safe = sanitizeForFilename(base.trim() || fallback);
  return safe.length ? safe : "relatorio";
}

function resolveClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function GET(req: NextRequest) {
  const ip = resolveClientIp(req);
  const rateResult = await rateLimit(req, `dashboard-export:${ip}`, 10, 60);
  if (rateResult.limited) {
    return rateResult.response ?? NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const searchParams = req.nextUrl.searchParams;
  const slugParam = searchParams.get("slug") ?? searchParams.get("company");
  const rawSlug = slugParam?.trim() ?? "";
  if (!rawSlug) {
    return NextResponse.json({ error: "Empresa nao informada" }, { status: 400 });
  }

  const company = await findCompanyBySlugOrId(rawSlug);
  if (!company) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    assertCompanyAccess(authUser, company.id);
  } catch (error) {
    if (error instanceof CompanyAccessError && company.slug && company.slug !== company.id) {
      try {
        assertCompanyAccess(authUser, company.slug);
      } catch (inner) {
        if (inner instanceof CompanyAccessError) {
          return NextResponse.json({ error: "Sem acesso a empresa" }, { status: 403 });
        }
        throw inner;
      }
    } else if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: "Sem acesso a empresa" }, { status: 403 });
    } else {
      throw error;
    }
  }

  const periodKey = resolveDashboardPeriod(searchParams.get("period"));
  const slaRaw = searchParams.get("slaHours");
  const parsedSla = slaRaw ? Number.parseInt(slaRaw, 10) : Number.NaN;
  const slaHours = Number.isFinite(parsedSla) && parsedSla > 0 ? parsedSla : undefined;

  try {
    const effectiveSlug = company.slug ?? rawSlug ?? company.id;
    const generatedAt = new Date();
    const summary = await buildDashboardSummary({
      companySlug: effectiveSlug,
      periodKey,
      slaHours,
    });

    const timestamp = generatedAt.toISOString().replace(/[:]/g, "-").replace(/T/, "-").split(".")[0];
    const defaultName = `${effectiveSlug}-dashboard-${periodKey}-${timestamp}`;
    const fileName = resolveFileName(searchParams.get("fileName"), defaultName);

    const pdfBytes = await buildDashboardSummaryPdf({
      companyName: company.name ?? company.company_name ?? effectiveSlug,
      companySlug: effectiveSlug,
      summary,
      periodKey,
      generatedAt,
      slaHours: slaHours ?? null,
      requestedBy: {
        id: authUser.id,
        email: authUser.email,
        name: (authUser as { name?: string | null }).name ?? null,
      },
    });

    const buffer = Buffer.from(pdfBytes);
    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `attachment; filename="${fileName}.pdf"`);
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Length", buffer.length.toString());
    headers.set("X-Export-Company", effectiveSlug);
    headers.set("X-Export-Period", periodKey);

    console.info("[dashboard-export]", {
      companyId: company.id,
      companySlug: company.slug,
      actor: authUser.id ?? authUser.email,
      periodKey,
      slaHours,
      fileName,
      size: buffer.length,
    });

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error("[dashboard-export] Failed to generate PDF", error);
    return NextResponse.json({ error: "Erro ao gerar relatorio" }, { status: 500 });
  }
}
