import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { isCompanyUser } from "@/lib/rbac/companyAccess";
import { withCompanyValidation } from "@/lib/middleware/withCompanyValidation";
import { ProjectsStore, type ProjectRecord } from "@/lib/projects/projectsStore";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: { message: "Nao autorizado" } }, { status: 401 });
  if (!isCompanyUser(auth)) {
    return NextResponse.json({ error: { message: "Sem permissao" } }, { status: 403 });
  }

  if (!QASE_TOKEN) {
    return NextResponse.json({ data: [], warning: "QASE_API_TOKEN ausente" }, { status: 200 });
  }

  const res = await fetch(`${QASE_BASE_URL}/v1/project`, {
    headers: { Token: QASE_TOKEN, Accept: "application/json" },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message = asRecord(json)?.error && asRecord(asRecord(json)?.error)?.message;
    return NextResponse.json({ error: { message: (message as string) || "Erro ao consultar Qase" } }, { status: res.status });
  }

  const result = asRecord(json)?.result;
  const entities = Array.isArray(asRecord(result)?.entities) ? (asRecord(result)?.entities as unknown[]) : [];
  const data = entities
    .map((p) => {
      const rec = asRecord(p) ?? {};
      const code = typeof rec.code === "string" ? rec.code : typeof rec.project === "string" ? rec.project : "";
      const title = typeof rec.title === "string" ? rec.title : typeof rec.name === "string" ? rec.name : code;
      return code ? { code, title } : null;
    })
    .filter(Boolean);

  return NextResponse.json({ data }, { status: 200 });
}

export const POST = withCompanyValidation(async (user, companyId, req) => {
  const body = await req.json().catch(() => ({}));
  const record = {
    id: crypto.randomUUID(),
    code: typeof body.code === "string" ? body.code : null,
    title: typeof body.title === "string" ? body.title : String(body.title ?? "Untitled"),
    description: typeof body.description === "string" ? body.description : null,
    companyId,
    createdBy: user.id,
    createdAt: new Date().toISOString(),
  };

  await ProjectsStore.create(record as ProjectRecord);
  return NextResponse.json({ success: true, project: record }, { status: 201 });
});

export const PUT = withCompanyValidation(async (user, companyId, req) => {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  const updates: Partial<ProjectRecord> = {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
    ...(typeof body.code === "string" ? { code: body.code } : {}),
    companyId,
  };

  const updated = await ProjectsStore.update(id, updates);
  if (!updated) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  return NextResponse.json({ success: true, project: updated }, { status: 200 });
});

export const DELETE = withCompanyValidation(async (user, companyId, req) => {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  const ok = await ProjectsStore.delete(id, companyId);
  return NextResponse.json({ success: ok }, { status: 200 });
});
