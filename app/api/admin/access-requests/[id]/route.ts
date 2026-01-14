import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireGlobalAdmin } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type Payload = {
  email?: string;
  name?: string;
  role?: string;
  company?: string;
  client_id?: string;
  access_type?: string;
  notes?: string;
  status?: string;
  admin_notes?: string;
};

type AccessType = "user" | "admin" | "company";

function sanitize(value: unknown, max = 255): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function normalizeAccessType(value: string): AccessType | null {
  const v = value.trim().toLowerCase();
  if (
    v === "usuario comum" ||
    v === "usuário comum" ||
    v === "usuário da empresa" ||
    v === "usuario da empresa" ||
    v === "user" ||
    v === "common"
  ) {
    return "user";
  }
  if (v === "admin do sistema" || v === "administrador do sistema" || v === "administrador" || v === "admin") {
    return "admin";
  }
  if (v === "admin da empresa" || v === "administrador da empresa" || v === "empresa" || v === "company") {
    return "company";
  }
  return null;
}

function accessTypeLabel(value: AccessType): string {
  if (value === "admin") return "Admin do sistema";
  if (value === "company") return "Admin da empresa";
  return "Usuário da empresa";
}

function mapAccessTypeToRole(value: AccessType): "global_admin" | "client_admin" | "client_user" {
  if (value === "admin") return "global_admin";
  if (value === "company") return "client_admin";
  return "client_user";
}

function composeAccessRequestMessage(input: {
  email: string;
  name: string;
  role: string;
  company: string;
  clientId: string | null;
  accessType: AccessType;
  notes: string;
}): string {
  const payload = {
    v: 1,
    kind: "access_request",
    email: input.email,
    name: input.name,
    jobRole: input.role,
    company: input.company,
    clientId: input.clientId,
    accessType: input.accessType,
    mappedAppRole: mapAccessTypeToRole(input.accessType),
    notes: input.notes || null,
  };

  return [
    `ACCESS_REQUEST_V1 ${JSON.stringify(payload)}`,
    "Solicitacao de acesso ao admin",
    `Tipo de acesso: ${accessTypeLabel(input.accessType)}`,
    `Empresa: ${input.company}${input.clientId ? ` (id: ${input.clientId})` : ""}`,
    `Cargo: ${input.role}`,
    `Nome: ${input.name}`,
    `Email: ${input.email}`,
    input.notes ? `Observacoes: ${input.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}


export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = await requireGlobalAdmin(req);
    if (!admin) return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Payload;

    const email = sanitize(body.email, 255).toLowerCase();
    const name = sanitize(body.name, 255);
    const role = sanitize(body.role, 255);
    const company = sanitize(body.company, 255);
    const clientId = sanitize(body.client_id, 128);
    const notes = sanitize(body.notes, 1000);

    const accessTypeRaw = sanitize(body.access_type, 40);
    const accessType = accessTypeRaw ? normalizeAccessType(accessTypeRaw) : null;

    const status = sanitize(body.status, 40).toLowerCase();
    const adminNotes = sanitize(body.admin_notes, 1000);

    const updates: Record<string, unknown> = {};
    if (email) updates.email = email;
    if (status) updates.status = status;
    if (adminNotes || body.admin_notes === "") updates.admin_notes = adminNotes || null;

    if (email && name && role && accessType) {
      updates.message = composeAccessRequestMessage({
        email,
        name,
        role,
        company: company || "(nao informado)",
        clientId: clientId || null,
        accessType,
        notes,
      });
    }

    const service = getSupabaseServer();
    const { error } = await service.from("support_requests").update(updates).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Falha ao atualizar solicitacao" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
