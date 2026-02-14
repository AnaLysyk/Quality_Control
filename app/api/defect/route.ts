import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { authenticateRequest } from "@/lib/jwtAuth";
import { CompanyAccessError, assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";

const MAX_TITLE_LENGTH = 140;
const MAX_DESCRIPTION_LENGTH = 2000;

function normalizeString(input: unknown, { required = false, maxLength }: { required?: boolean; maxLength?: number } = {}) {
  if (typeof input !== "string") {
    if (required) return null;
    return null;
  }
  const trimmed = input.trim();
  if (required && !trimmed) return null;
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed || null;
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function ensureCompanyAccess(req: NextRequest, companyId: string) {
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return { error: jsonError(401, "Nao autorizado") } as const;
  }

  try {
    assertCompanyAccess(authUser, companyId);
  } catch (error) {
    if (error instanceof CompanyAccessError) {
      if (error.code === "MISSING_COMPANY_ID") {
        return { error: jsonError(400, "companyId obrigatorio") } as const;
      }
      return { error: jsonError(403, "Sem acesso a empresa") } as const;
    }
    throw error;
  }

  return { authUser } as const;
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return jsonError(400, "JSON invalido");
  }

  const companyId = normalizeString(payload.companyId, { required: true, maxLength: 120 });
  if (!companyId) {
    return jsonError(400, "companyId obrigatorio");
  }

  const access = await ensureCompanyAccess(req, companyId);
  if ("error" in access) return access.error;

  const title = normalizeString(payload.title, { required: true, maxLength: MAX_TITLE_LENGTH });
  if (!title) {
    return jsonError(400, "title obrigatorio");
  }

  const description = normalizeString(payload.description, { maxLength: MAX_DESCRIPTION_LENGTH });
  const releaseManualId = normalizeString(payload.releaseManualId, { maxLength: 120 });

  try {
    const existingDefect = await prisma.defect.findFirst({
      where: {
        companyId,
        title,
        releaseManualId: releaseManualId ?? null,
      },
      select: { id: true },
    });

    if (existingDefect) {
      return jsonError(409, "Defeito ja cadastrado");
    }

    const defect = await prisma.defect.create({
      data: {
        title,
        description,
        companyId,
        releaseManualId: releaseManualId ?? null,
      },
    });

    return NextResponse.json({ ok: true, defect }, { status: 201 });
  } catch (error) {
    console.error("[api/defect] Failed to create defect", error);
    return jsonError(500, "Erro ao criar defeito");
  }
}

export async function GET(req: NextRequest) {
  const companyId = normalizeString(req.nextUrl.searchParams.get("companyId"), { required: true, maxLength: 120 });
  if (!companyId) {
    return jsonError(400, "companyId obrigatorio");
  }

  const access = await ensureCompanyAccess(req, companyId);
  if ("error" in access) return access.error;

  const releaseManualId = normalizeString(req.nextUrl.searchParams.get("releaseManualId"), { maxLength: 120 });

  try {
    const defects = await prisma.defect.findMany({
      where: {
        companyId,
        ...(releaseManualId ? { releaseManualId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, defects });
  } catch (error) {
    console.error("[api/defect] Failed to fetch defects", error);
    return jsonError(500, "Erro ao buscar defeitos");
  }
}
