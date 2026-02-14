import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { CompanyAccessError, assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { findLocalCompanyById, findLocalCompanyBySlug } from "@/lib/auth/localStore";
import { rateLimit } from "@/lib/rateLimit";
import {
  loadReleaseContext,
  ReleaseExportError,
} from "@/lib/reporting/releaseExport";

async function findCompanyBySlugOrId(slug: string) {
  const bySlug = await findLocalCompanyBySlug(slug).catch(() => null);
  if (bySlug) return bySlug;
  return findLocalCompanyById(slug).catch(() => null);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string; releaseSlug: string }> },
) {
  const { slug, releaseSlug } = await context.params;
  const companySlugParam = (slug ?? "").trim();
  const releaseSlugParam = (releaseSlug ?? "").trim();

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

  const limiterKey = `release-timeline:${authUser.id}:${company.id}`;
  const rateResult = await rateLimit(req, limiterKey, 30, 60);
  if (rateResult.limited) {
    return (
      rateResult.response ?? NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    );
  }

  try {
    const contextData = await loadReleaseContext(
      {
        id: company.id,
        slug: company.slug ?? company.id,
        name: company.name ?? company.company_name ?? company.slug ?? company.id,
        company_name: company.company_name ?? null,
      },
      releaseSlugParam,
    );

    console.info("[release-timeline]", {
      companyId: company.id,
      companySlug: company.slug,
      release: contextData.release.slug,
      actor: authUser.id ?? authUser.email ?? "anonymous",
    });

    return NextResponse.json(contextData.timeline);
  } catch (error) {
    if (error instanceof ReleaseExportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[release-timeline] Failed", error);
    return NextResponse.json({ error: "Erro ao obter timeline" }, { status: 500 });
  }
}
