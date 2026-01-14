import { NextRequest, NextResponse } from "next/server";
import { AUDIT_LOG_RETENTION_DAYS, isAuditLogStorageConfigured, listAuditLogs } from "@/data/auditLogRepository";
import { requireGlobalAdmin } from "@/lib/rbac/requireGlobalAdmin";

export async function GET(req: NextRequest) {
  const admin = await requireGlobalAdmin(req);
  if (!admin) return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? "200");
  const offset = Number(searchParams.get("offset") ?? "0");
  const action = searchParams.get("action");

  const storageReady = isAuditLogStorageConfigured();

  try {
    const items = await listAuditLogs({ limit, offset, action });
    return NextResponse.json({
      items,
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      warning: storageReady
        ? null
        : "Audit logs desativado neste ambiente: configure POSTGRES_URL/DATABASE_URL para persistir os registros.",
    });
  } catch {
    return NextResponse.json(
      {
        items: [],
        retentionDays: AUDIT_LOG_RETENTION_DAYS,
        warning:
          "Não foi possível carregar audit logs (banco indisponível ou tabela ausente). Configure POSTGRES_URL/DATABASE_URL e rode a migração da tabela audit_logs.",
      },
      { status: 200 }
    );
  }
}
