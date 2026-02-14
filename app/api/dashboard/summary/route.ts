import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { CompanyAccessError, assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { findLocalCompanyById, findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { getRedis } from "@/lib/redis";
import { rateLimit } from "@/lib/rateLimit";
import { buildDashboardSummary, resolveDashboardPeriod } from "@/lib/services/dashboardSummary";

async function findCompanyBySlugOrId(slug: string) {
  const bySlug = await findLocalCompanyBySlug(slug).catch(() => null);
  if (bySlug) return bySlug;
  return findLocalCompanyById(slug).catch(() => null);
}

export async function GET(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0] || req.headers.get("x-real-ip") || "unknown";
  const rateResult = await rateLimit(req, `dashboard-summary:${ip}`, 30, 60);
  if (rateResult.limited) {
    return rateResult.response ?? NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const slug = req.nextUrl.searchParams.get("slug")?.trim() ?? "";
  if (!slug) {
    return NextResponse.json({ error: "Empresa nao informada" }, { status: 400 });
  }

  const company = await findCompanyBySlugOrId(slug);
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

  const periodKey = resolveDashboardPeriod(req.nextUrl.searchParams.get("period"));
  const slaRaw = req.nextUrl.searchParams.get("slaHours");
  const parsedSla = slaRaw ? Number.parseInt(slaRaw, 10) : Number.NaN;
  const slaHours = Number.isFinite(parsedSla) && parsedSla > 0 ? parsedSla : null;
  const dataCompanySlug = company.slug ?? slug ?? company.id;

  const cacheKeyParts = ["dash", dataCompanySlug, periodKey];
  if (slaHours != null) {
    cacheKeyParts.push(`sla${slaHours}`);
  }
  const cacheKey = cacheKeyParts.join(":");

  const redis = getRedis();
  const cached = await redis.get<string>(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return NextResponse.json(parsed);
    } catch (error) {
      console.warn("[dashboard-summary] Failed to parse cache", error);
      await redis.del(cacheKey).catch(() => {});
    }
  }

  const response = await buildDashboardSummary({
    companySlug: dataCompanySlug,
    periodKey,
    slaHours: slaHours ?? undefined,
  });

  await redis.set(cacheKey, JSON.stringify(response), { ex: 120 }).catch(() => {});

  return NextResponse.json(response);
}
