import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { getAccessRequestById, updateAccessRequest } from "@/data/accessRequestsStore";

type AccessType = "user" | "admin" | "company";

const MAX_FIELD_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const MAX_JSON_BYTES = 16 * 1024;

const ACCESS_TYPE_MAP: Record<string, AccessType> = {
  usuario: "user",
  "usuário": "user",
  "usuario da empresa": "user",
  "usuário da empresa": "user",
  "usuÃ¡rio da empresa": "user",
  "usuÃ¡rio": "user",
  user: "user",
  admin: "admin",
  administrador: "admin",
  "admin do sistema": "admin",
  empresa: "company",
  "admin da empresa": "company",
  company: "company",
};

function cleanString(value: unknown, max = MAX_FIELD_LENGTH) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > max ? normalized.slice(0, max) : normalized;
}

function normalizeAccessType(value?: string | null): AccessType | null {
  if (!value) return null;
  return ACCESS_TYPE_MAP[value.trim().toLowerCase()] ?? null;
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
    `Tipo de acesso: ${input.accessType === "admin" ? "Admin do sistema" : input.accessType === "company" ? "Admin da empresa" : "Usuário da empresa"}`,
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

function json(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function validateJsonRequest(req: Request) {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("UNSUPPORTED_MEDIA");
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  try {
    validateJsonRequest(req);
  } catch (error) {
    if (error instanceof Error && error.message === "UNSUPPORTED_MEDIA") {
      return json({ error: "Content-Type invalido" }, { status: 415 });
    }
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return json({ error: "Payload muito grande" }, { status: 413 });
    }
    return json({ error: "Requisicao invalida" }, { status: 400 });
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
    return json({ error: "Payload invalido" }, { status: 400 });
  }

  const { id } = await context.params;
  if (shouldUseJsonStore()) {
    const existing = await getAccessRequestById(id);
    if (!existing) {
      return json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }

    const emailInput = cleanString(body.email, 320);
    const email = emailInput ? emailInput.toLowerCase() : existing.email;
    const name = cleanString(body.name);
    const role = cleanString(body.role);
    const company = cleanString(body.company);
    const clientIdValue = cleanString(body.client_id, MAX_FIELD_LENGTH);
    const clientId = clientIdValue || null;
    const accessType = normalizeAccessType(body.access_type) ?? "user";
    const notes = cleanString(body.notes, MAX_NOTES_LENGTH);
    const adminNotesValue = cleanString(body.admin_notes, MAX_NOTES_LENGTH);
    const adminNotes = adminNotesValue || null;

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
      return json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }

    return json({
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
    return json({ error: "Solicitacao nao encontrada" }, { status: 404 });
  }

  const emailInput = cleanString(body.email, 320);
  const email = emailInput ? emailInput.toLowerCase() : existing.email;
  const name = cleanString(body.name);
  const role = cleanString(body.role);
  const company = cleanString(body.company);
  const clientIdValue = cleanString(body.client_id, MAX_FIELD_LENGTH);
  const clientId = clientIdValue || null;
  const accessType = normalizeAccessType(body.access_type) ?? "user";
  const notes = cleanString(body.notes, MAX_NOTES_LENGTH);
  const adminNotesValue = cleanString(body.admin_notes, MAX_NOTES_LENGTH);
  const adminNotes = adminNotesValue || null;

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

  return json({
    item: {
      id: updated.id,
      email: updated.email,
      message: updated.message,
      status: updated.status,
      created_at: updated.created_at.toISOString(),
    },
  });
}
