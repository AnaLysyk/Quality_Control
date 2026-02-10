import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";

type AccessType = "user" | "admin" | "company";

function normalizeAccessType(value?: string | null): AccessType | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (
    v === "usuario da empresa" ||
    v === "usuÃ¡rio da empresa" ||
    v === "usuario" ||
    v === "user"
  ) {
    return "user";
  }
  if (v === "admin do sistema" || v === "administrador" || v === "admin") {
    return "admin";
  }
  if (v === "admin da empresa" || v === "empresa" || v === "company") {
    return "company";
  }
  return null;
}

function composeAccessRequestMessage(input: {
  email: string;
  name: string;
  role: string;
  company: string;
  clientId: string | null;
  accessType: AccessType;
  notes: string;
  adminNotes?: string | null;
}) {
  const payload = {
    v: 1,
    kind: "access_request",
    email: input.email,
    name: input.name,
    jobRole: input.role,
    company: input.company,
    clientId: input.clientId,
    accessType: input.accessType,
    notes: input.notes || null,
  };

  const lines = [
    `ACCESS_REQUEST_V1 ${JSON.stringify(payload)}`,
    "Solicitacao de acesso ao admin",
    `Tipo de acesso: ${input.accessType === "admin" ? "Admin do sistema" : input.accessType === "company" ? "Admin da empresa" : "UsuÃ¡rio da empresa"}`,
    `Empresa: ${input.company}${input.clientId ? ` (id: ${input.clientId})` : ""}`,
    `Cargo: ${input.role}`,
    `Nome: ${input.name}`,
    `Email: ${input.email}`,
    input.notes ? `Observacoes: ${input.notes}` : "",
  ].filter(Boolean);

  if (input.adminNotes && input.adminNotes.trim()) {
    lines.push(`ADMIN_NOTES: ${input.adminNotes.trim()}`);
  }

  return lines.join("\n");
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    name?: string;
    role?: string;
    company?: string;
    client_id?: string | null;
    access_type?: string;
    notes?: string;
    admin_notes?: string | null;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const { id } = await context.params;
  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : existing.email;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";
    const clientId =
      typeof body.client_id === "string" && body.client_id.trim() ? body.client_id.trim() : null;
    const accessType = normalizeAccessType(body.access_type) ?? "user";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const adminNotes = typeof body.admin_notes === "string" ? body.admin_notes.trim() : null;

    const message = composeAccessRequestMessage({
      email,
      name,
      role,
      company,
      clientId,
      accessType,
      notes,
      adminNotes,
    });

    const updated = await updateAccessRequest(id, { email, message });
    if (!updated) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        id: updated.id,
        email: updated.email,
        message: updated.message,
        status: updated.status,
        created_at: updated.created_at,
      },
    });
  }

  const existing = await prisma.supportRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : existing.email;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const clientId =
    typeof body.client_id === "string" && body.client_id.trim() ? body.client_id.trim() : null;
  const accessType = normalizeAccessType(body.access_type) ?? "user";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const adminNotes = typeof body.admin_notes === "string" ? body.admin_notes.trim() : null;

  const message = composeAccessRequestMessage({
    email,
    name,
    role,
    company,
    clientId,
    accessType,
    notes,
    adminNotes,
  });

  const updated = await prisma.supportRequest.update({
    where: { id },
    data: {
      email,
      message,
    },
  });

  return NextResponse.json({
    item: {
      id: updated.id,
      email: updated.email,
      message: updated.message,
      status: updated.status,
      created_at: updated.created_at.toISOString(),
    },
  });
}
