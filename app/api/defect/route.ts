// Importa utilitÃ¡rios do Next.js para lidar com requisiÃ§Ãµes e respostas
import { NextRequest, NextResponse } from "next/server";
// Importa o cliente Prisma para acesso ao banco de dados
import { prisma } from "../../../lib/prismaClient";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { brainOnDefectCreated } from "@/lib/brain/autoSync";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { hasGlobalCompanyVisibility } from "@/lib/companyDefectsAccess";
import { assertCompanyAccess } from "@/lib/rbac/validateCompanyAccess";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/lib/auth/roles";

function hasGlobalDefectWriteAccess(user: AuthUser) {
  if (user.isGlobalAdmin) return true;
  return [user.role, user.globalRole, user.permissionRole, user.companyRole]
    .some((role) => normalizeLegacyRole(role) === SYSTEM_ROLES.LEADER_TC);
}

async function requireDefectCompanyAccess(req: NextRequest, companyId: string | null, mode: "read" | "write") {
  const user = await authenticateRequest(req);
  if (!user) {
    return { response: NextResponse.json({ error: "NÃ£o autorizado" }, { status: 401 }) };
  }
  if (!companyId) {
    return { response: NextResponse.json({ error: "companyId Ã© obrigatÃ³rio" }, { status: 400 }) };
  }
  if (mode === "read" && hasGlobalCompanyVisibility(user)) {
    return { user };
  }
  if (mode === "write" && hasGlobalDefectWriteAccess(user)) {
    return { user };
  }
  if (mode === "write" && hasGlobalCompanyVisibility(user)) {
    return { response: NextResponse.json({ error: "Acesso proibido" }, { status: 403 }) };
  }

  try {
    await assertCompanyAccess(user, companyId);
    return { user };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "MISSING_COMPANY_ID" ? 400 : 403;
    const errorMessage = status === 400 ? "companyId Ã© obrigatÃ³rio" : "Acesso proibido";
    return { response: NextResponse.json({ error: errorMessage }, { status }) };
  }
}

// POST: Cria um novo defeito para uma empresa e release manual
// Espera receber no corpo: title, description, companyId, releaseManualId
export async function POST(req: NextRequest) {
  // LÃª os dados enviados na requisiÃ§Ã£o
  const data = await req.json();
  const { title, description, companyId, releaseManualId } = data;
  // VÃ¡lida se os campos obrigatÃ³rios foram enviados
  if (!title || !companyId) {
    return NextResponse.json({ error: "title e companyId sÃ£o obrigatÃ³rios" }, { status: 400 });
  }
  const access = await requireDefectCompanyAccess(req, companyId, "write");
  if ("response" in access) return access.response;

  // Cria o defeito no banco de dados usando o modelo Defect
  const defect = await prisma.defect.create({
    data: { title, description, companyId, releaseManualId },
  });

  addAuditLogSafe({
    action: "defect.created",
    entityType: "defect",
    entityId: defect.id,
    entityLabel: title,
    metadata: { companyId, releaseManualId: releaseManualId ?? null },
  });

  // Retorna o defeito criado com status 201 (Created)
  brainOnDefectCreated(defect).catch(() => {});
  return NextResponse.json(defect, { status: 201 });
}

// GET: Lista todos os defeitos de uma empresa (e opcionalmente de um release manual)
// ParÃ¢metros de busca: companyId (obrigatÃ³rio), releaseManualId (opcional)
export async function GET(req: NextRequest) {
  // ObtÃ©m o companyId e releaseManualId dos parÃ¢metros da URL
  const companyId = req.nextUrl.searchParams.get("companyId");
  const releaseManualId = req.nextUrl.searchParams.get("releaseManualId");
  // VÃ¡lida se o companyId foi informado
  if (!companyId) {
    return NextResponse.json({ error: "companyId Ã© obrigatÃ³rio" }, { status: 400 });
  }
  const access = await requireDefectCompanyAccess(req, companyId, "read");
  if ("response" in access) return access.response;

  // Busca todos os defeitos da empresa (e opcionalmente do release manual)
  const defects = await prisma.defect.findMany({
    where: {
      companyId,
      ...(releaseManualId ? { releaseManualId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  // Retorna a lista de defeitos encontrados
  return NextResponse.json(defects);
}

