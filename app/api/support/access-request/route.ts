import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/jwtAuth";

type Payload = {
  email?: string;
  company?: string;
  client_id?: string;
  name?: string;
  role?: string;
  access_type?: string;
  notes?: string;
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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const email = sanitize(body.email, 255).toLowerCase();
  const company = sanitize(body.company, 255);
  const clientId = sanitize(body.client_id, 128);
  const name = sanitize(body.name, 255);
  const role = sanitize(body.role, 255);
  const notes = sanitize(body.notes, 1000);
  const accessTypeRaw = sanitize(body.access_type, 40);
  const accessType = accessTypeRaw ? normalizeAccessType(accessTypeRaw) : null;

  if (!email || !name || !role || !accessType) {
    return NextResponse.json({ message: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  // For non-admin access, a company is required.
  if (accessType !== "admin" && !(company || clientId)) {
    return NextResponse.json({ message: "Empresa e obrigatoria para este tipo de acesso" }, { status: 400 });
  }

  const authUser = await authenticateRequest(req);
  const userId = authUser?.id ?? null;
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;

  const composedMessage = composeAccessRequestMessage({
    email,
    name,
    role,
    company: company || "(nao informado)",
    clientId: clientId || null,
    accessType,
    notes,
  });

  try {
    await prisma.supportRequest.create({
      data: {
        email,
        message: composedMessage,
        status: "open",
        ip_address,
        user_agent,
        user_id: userId,
      },
    });
  } catch (error) {
    console.error("Erro ao registrar support_request:", error);
    return NextResponse.json({ message: "Erro interno ao registrar solicitação" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Solicitação enviada. O administrador será notificado.",
  });
}

export async function GET(req: Request) {
  // Apenas admins podem listar
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  if (!authUser.isGlobalAdmin) {
    return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
  }

  try {
    const items = await prisma.supportRequest.findMany({
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Erro ao listar support_requests:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }
}
