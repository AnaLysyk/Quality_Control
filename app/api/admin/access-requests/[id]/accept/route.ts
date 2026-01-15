import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const runtime = "nodejs";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type AccessType = "user" | "admin" | "company";

function sanitize(value: unknown, max = 255): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function parseMessage(message: string): { email?: string; name?: string; clientId?: string | null; accessType?: AccessType } | null {
  const prefix = "ACCESS_REQUEST_V1 ";
  const line = message.split("\n").find((l) => l.startsWith(prefix));
  if (!line) return null;
  try {
    const json = JSON.parse(line.slice(prefix.length));
    if (!json || typeof json !== "object") return null;
    const rec = json as Record<string, unknown>;
    const email = typeof rec.email === "string" ? rec.email : undefined;
    const name = typeof rec.name === "string" ? rec.name : undefined;
    const clientId = typeof rec.clientId === "string" ? rec.clientId : null;
    const accessType = rec.accessType === "admin" || rec.accessType === "company" || rec.accessType === "user" ? (rec.accessType as AccessType) : undefined;
    return { email, name, clientId, accessType };
  } catch {
    return null;
  }
}

function mapAccessTypeToRole(value: AccessType): "global_admin" | "client_admin" | "client_user" {
  if (value === "admin") return "global_admin";
  if (value === "company") return "client_admin";
  return "client_user";
}

function randomPassword() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

async function findAuthUserIdByEmail(service: SupabaseClient, email: string): Promise<string | null> {
  try {
    // Best-effort lookup (works for small user bases)
    const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return null;
    const match = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    return match?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const overrideEmail = sanitize(body.email, 255).toLowerCase();
    const overrideName = sanitize(body.name, 255);
    const overrideClientId = sanitize(body.client_id, 128);
    const overrideAccessTypeRaw = sanitize(body.access_type, 40);

    const service = getSupabaseServer();

    const { data: reqRow, error: reqError } = await service
      .from("support_requests")
      .select("id,email,message")
      .eq("id", id)
      .maybeSingle();

    if (reqError || !reqRow) {
      return NextResponse.json({ error: "Solicitacao nao encontrada" }, { status: 404 });
    }

    const parsed = parseMessage(String(reqRow.message ?? ""));
    const email = overrideEmail || (parsed?.email ?? String(reqRow.email ?? "")).toLowerCase();
    const name = overrideName || (parsed?.name ?? "");

    const accessType: AccessType =
      overrideAccessTypeRaw === "admin" || overrideAccessTypeRaw === "company" || overrideAccessTypeRaw === "user"
        ? (overrideAccessTypeRaw as AccessType)
        : (parsed?.accessType ?? "user");

    const clientId = overrideClientId || parsed?.clientId || null;

    const mappedRole = mapAccessTypeToRole(accessType);
    if (mappedRole !== "global_admin" && !clientId) {
      return NextResponse.json({ error: "Empresa obrigatoria para este tipo de acesso" }, { status: 400 });
    }

    if (SUPABASE_MOCK) {
      return NextResponse.json({ ok: true, invited: true, created: true }, { status: 200 });
    }

    // 1) Create/invite auth user
    let authUserId: string | null = null;

    const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
    });

    if (inviteError) {
      const message = (inviteError.message ?? "").toLowerCase();
      const duplicate = inviteError.status === 422 || message.includes("already") || message.includes("exists");
      if (!duplicate) {
        return NextResponse.json({ error: "Falha ao criar usuario no Supabase" }, { status: 500 });
      }
      authUserId = await findAuthUserIdByEmail(service, email);
      if (!authUserId) {
        return NextResponse.json({ error: "Usuario ja existe no Supabase (nao foi possivel localizar)" }, { status: 409 });
      }
    } else {
      authUserId = inviteData?.user?.id ?? null;
    }

    if (!authUserId) {
      return NextResponse.json({ error: "Falha ao criar usuario no Supabase" }, { status: 500 });
    }

    // If the access type grants global admin, also record it in `public.global_admins`.
    // Best-effort: ignore failures (e.g., table not present in some environments).
    if (mappedRole === "global_admin") {
      await service.from("global_admins").insert({ user_id: authUserId });
    }

    // 2) Insert application user record (public.users)
    const tempPassword = randomPassword();
    const passwordHash = createHash("sha256").update(tempPassword).digest("hex");

    const userRecord = {
      id: randomUUID(),
      name,
      email,
      role: mappedRole,
      client_id: mappedRole === "global_admin" ? null : clientId,
      active: true,
      password_hash: passwordHash,
      auth_user_id: authUserId,
      is_global_admin: mappedRole === "global_admin",
    };

    const { error: insertError } = await service.from("users").insert(userRecord);
    if (insertError) {
      const duplicate = insertError.code === "23505" || (insertError.message ?? "").toLowerCase().includes("duplicate");
      return NextResponse.json({ error: duplicate ? "Usuario ja existe" : "Falha ao criar usuario" }, { status: duplicate ? 409 : 500 });
    }

    // 3) Close request
    await service
      .from("support_requests")
      .update({ status: "closed", admin_notes: "Aceito: usuario criado automaticamente" })
      .eq("id", id);

    return NextResponse.json({ ok: true, invited: true, created: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
