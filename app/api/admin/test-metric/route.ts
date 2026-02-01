import { NextRequest } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { apiFail, apiOk } from "@/lib/apiResponse";

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const legacy = { error: status === 401 ? "Nao autenticado" : "Sem permissao" };
    return apiFail(req, legacy.error, {
      status,
      code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      extra: legacy,
    });
  }

  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  const mapped = companies.map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    status: "ativo",
    releases: null,
    approval: null,
  }));

  const payload = {
    totals: { approved: 0, failed: 0, neutral: 0, quality: 0 },
    clients: mapped,
  };
  return apiOk(req, payload, "OK", { extra: payload });
}
