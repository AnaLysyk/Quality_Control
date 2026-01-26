import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { SUPABASE_MOCK } from "@/lib/supabaseMock";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type RoleOption =
  | "global_admin"
  | "client_admin"
  | "client_user"
  | "client_owner"
  | "client_manager"
  | "client_member";
type NormalizedRole = "global_admin" | "client_admin" | "client_user";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

const sanitize = (value: unknown, max = 255) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
};

function isRoleOption(value: string | null): value is RoleOption {
  return (
    value === "global_admin" ||
    value === "client_admin" ||
    value === "client_user" ||
    value === "client_owner" ||
    value === "client_manager" ||
    value === "client_member"
  );
}

const normalizeRole = (value?: string | null): NormalizedRole => {
  if (value === "global_admin") return "global_admin";
  if (value === "client_admin" || value === "client_owner" || value === "client_manager") {
    return "client_admin";
  }
  return "client_user";
};

const requiresClient = (role: NormalizedRole) => role !== "global_admin";

function createSupabaseAuth() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createSupabaseService() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(req: NextRequest) {
  const service = createSupabaseService();
  const authClient = createSupabaseAuth();

  const { admin, status } = await requireGlobalAdminWithStatus(req, {
    supabaseAdmin: service,
    supabaseAuth: authClient,
    mockAdmin: { id: "mock-admin", email: "admin@example.com", token: "mock-token" },
  });

  if (!admin) return { admin: null, status };
  return { admin: { id: admin.id, email: admin.email }, status: 200 };
}

function randomPassword() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

async function handleCreate(req: NextRequest) {
  try {
    const { admin, status } = await requireAdmin(req);
    if (!admin) {
      const msg = status === 401 ? "Nao autenticado" : "Sem permissao";
      return apiFail(req, msg, {
        status,
        code: status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN",
        extra: { error: msg },
      });
    }

    const body = (await req.json().catch(() => null)) as unknown;
    const bodyRecord = asRecord(body);
    if (!bodyRecord) {
      const msg = "Payload invalido";
      return apiFail(req, msg, { status: 400, code: "VALIDATION_ERROR", extra: { error: msg } });
    }

    const name = sanitize(bodyRecord.name);
    const email = sanitize(bodyRecord.email);
    const clientId = sanitize(bodyRecord.client_id);
    const roleRaw = sanitize(bodyRecord.role);
    const roleInput = isRoleOption(roleRaw) ? roleRaw : null;
    const jobTitle = sanitize(bodyRecord.job_title);
    const linkedin = sanitize(bodyRecord.linkedin_url, 500);
    const avatarUrl = sanitize(bodyRecord.avatar_url, 1000);
    const password = sanitize(bodyRecord.password, 128);

    if (!name || !email) {
      const msg = "Nome e email sao obrigatorios";
      return apiFail(req, msg, { status: 400, code: "VALIDATION_ERROR", extra: { error: msg } });
    }

    const normalizedRole = normalizeRole(roleInput);
    if (requiresClient(normalizedRole) && !clientId) {
      const msg = "Empresa e obrigatoria para este perfil";
      return apiFail(req, msg, { status: 400, code: "VALIDATION_ERROR", extra: { error: msg } });
    }
    const tempPassword = password || randomPassword();
    const passwordHash = createHash("sha256").update(tempPassword).digest("hex");

    const supabaseService = createSupabaseService();
    const { data: inviteData, error: inviteError } = await supabaseService.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
    });

    if (inviteError) {
      const message = inviteError.message?.toLowerCase() || "";
      const duplicate = inviteError.status === 422 || message.includes("already") || message.includes("exists");
      const msg = duplicate ? "Usuario ja existe no Supabase" : "Falha ao criar usuario no Supabase";
      return apiFail(req, msg, {
        status: duplicate ? 409 : 500,
        code: duplicate ? "DUPLICATE" : "SUPABASE_INVITE_FAILED",
        details: inviteError,
        extra: { error: msg },
      });
    }

    const authUserId = inviteData?.user?.id;
    if (!authUserId) {
      const msg = "Falha ao criar usuario no Supabase";
      return apiFail(req, msg, { status: 500, code: "SUPABASE_INVITE_FAILED", extra: { error: msg } });
    }

    const userRecord = {
      id: randomUUID(),
      name,
      email,
      role: normalizedRole,
      client_id: requiresClient(normalizedRole) ? clientId : null,
      active: true,
      password_hash: passwordHash,
      job_title: jobTitle,
      linkedin_url: linkedin,
      avatar_url: avatarUrl ?? null,
      auth_user_id: authUserId,
      is_global_admin: normalizedRole === "global_admin",
    };

    const { error: insertError } = await supabaseService.from("users").insert(userRecord);

    if (insertError) {
      try {
        await supabaseService.auth.admin.deleteUser(authUserId);
      } catch {
        /* ignore cleanup errors */
      }
      const duplicate = insertError.message?.toLowerCase().includes("duplicate") || insertError.code === "23505";
      const msg = duplicate ? "Usuario ja existe" : "Falha ao criar usuario";
      return apiFail(req, msg, {
        status: duplicate ? 409 : 500,
        code: duplicate ? "DUPLICATE" : "DB_ERROR",
        details: insertError,
        extra: { error: msg },
      });
    }

    if (normalizedRole === "global_admin") {
      await supabaseService.from("global_admins").insert({ user_id: authUserId });
    }

    await addAuditLogSafe({
      actorUserId: admin.id,
      actorEmail: admin.email,
      action: "user.created",
      entityType: "user",
      entityId: userRecord.id,
      entityLabel: userRecord.email,
      metadata: { role: userRecord.role, client_id: userRecord.client_id, invited: true },
    });

    const out = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      client_id: userRecord.client_id,
      invited: true,
    };
    return apiOk(req, out, "Usuario criado", { status: 201, extra: out });
  } catch (err) {
    console.error("Erro inesperado em /api/admin/users:", err);
    const msg = "Erro interno";
    return apiFail(req, msg, { status: 500, code: "INTERNAL", details: err, extra: { error: msg } });
  }
}

async function handleUpdate(req: NextRequest) {
  try {
    const { admin, status } = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
    }

    if (SUPABASE_MOCK) {
      const body = (await req.json().catch(() => null)) as unknown;
      const record = asRecord(body);
      if (!record?.id) {
        return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });
      }
      return NextResponse.json(
        {
          ...record,
          tempPassword: undefined,
        },
        { status: 200 },
      );
    }

    const body = (await req.json().catch(() => null)) as unknown;
    const record = asRecord(body);
    if (!record) {
      return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    const id = sanitize(record.id);
    if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });

    const name = sanitize(record.name);
    const email = sanitize(record.email);
    const clientId = sanitize(record.client_id);
    const roleRaw = sanitize(record.role);
    const roleInput = isRoleOption(roleRaw) ? roleRaw : null;
    const jobTitle = sanitize(record.job_title);
    const linkedin = sanitize(record.linkedin_url, 500);
    const password = sanitize(record.password, 128);
    const active = typeof record.active === "boolean" ? record.active : undefined;

    const normalizedRole: NormalizedRole | undefined = roleInput ? normalizeRole(roleInput) : undefined;

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (clientId) updates.client_id = clientId;
    if (normalizedRole) {
      updates.role = normalizedRole;
      updates.is_global_admin = normalizedRole === "global_admin";
      if (normalizedRole === "global_admin") {
        updates.client_id = null;
      }
    }
    if (typeof active === "boolean") updates.active = active;
    if (jobTitle !== null) updates.job_title = jobTitle;
    if (linkedin !== null) updates.linkedin_url = linkedin;
    if (password) {
      const passwordHash = createHash("sha256").update(password).digest("hex");
      updates.password_hash = passwordHash;
    }

    const supabaseService = createSupabaseService();
    const { data, error } = await supabaseService
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Falha ao atualizar usuario" }, { status: 500 });
    }

    if (normalizedRole) {
      const updated = data as unknown as { auth_user_id?: unknown } | null;
      const authUserId = typeof updated?.auth_user_id === "string" ? updated.auth_user_id : null;
      if (authUserId) {
        if (normalizedRole === "global_admin") {
          await supabaseService.from("global_admins").insert({ user_id: authUserId });
        } else {
          await supabaseService.from("global_admins").delete().eq("user_id", authUserId);
        }
      }
    }

    await addAuditLogSafe({
      actorUserId: admin.id,
      actorEmail: admin.email,
      action: "user.updated",
      entityType: "user",
      entityId: id,
      entityLabel: typeof (data as any)?.email === "string" ? (data as any).email : null,
      metadata: { updates: Object.keys(updates) },
    });

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado em /api/admin/users PATCH:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("client_id");

    if (SUPABASE_MOCK) {
      const items = [
        {
          id: "mock-user-1",
          name: "Ana Mock",
          email: "ana.mock@example.com",
          role: "client_user",
          client_id: clientId ?? "mock-client",
          job_title: "QA",
          linkedin_url: "https://www.linkedin.com/in/mock",
          active: true,
        },
      ];
      return NextResponse.json({ items }, { status: 200 });
    }

    const { admin, status } = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
    }

    // Se faltar configuracao de service role, retorna lista vazia para nao quebrar UI
    if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_URL) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const supabaseService = createSupabaseService();
    const query = supabaseService
      .from("users")
      .select("id,name,email,role,client_id,job_title,linkedin_url,active,avatar_url")
      .order("name", { ascending: true });

    if (clientId) query.eq("client_id", clientId);

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao listar usuarios:", error);
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    return NextResponse.json({ items: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("Erro inesperado em /api/admin/users GET:", err);
    // fallback defensivo para nao quebrar UI
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (SUPABASE_MOCK) {
    try {
      const body = (await req.json().catch(() => null)) as unknown;
      const record = asRecord(body) ?? {};

      const name = sanitize(record.name);
      const email = sanitize(record.email);
      const roleRaw = sanitize(record.role) ?? "client_user";
      const normalizedRole = normalizeRole(isRoleOption(roleRaw) ? roleRaw : "client_user");
      const client_id = sanitize(record.client_id);
      const job_title = sanitize(record.job_title);
      const linkedin_url = sanitize(record.linkedin_url, 500);

      if (!name || !email) {
        const msg = "Nome e email sao obrigatorios";
        return apiFail(req, msg, { status: 400, code: "VALIDATION_ERROR", extra: { error: msg } });
      }
      if (requiresClient(normalizedRole) && !client_id) {
        const msg = "Empresa e obrigatoria para este perfil";
        return apiFail(req, msg, { status: 400, code: "VALIDATION_ERROR", extra: { error: msg } });
      }
      const out = {
        id: "mock-local-user-id",
        name,
        email,
        role: normalizedRole,
        client_id: requiresClient(normalizedRole) ? client_id : null,
        job_title: job_title ?? null,
        linkedin_url: linkedin_url ?? null,
        invited: true,
        message: "Usuario criado (mock).",
      };
      return apiOk(req, out, "Usuario criado", { status: 201, extra: out });
    } catch (err) {
      console.error("Erro mock /api/admin/users:", err);
      const msg = "Erro interno (mock)";
      return apiFail(req, msg, { status: 500, code: "INTERNAL", details: err, extra: { error: msg } });
    }
  }

  return handleCreate(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpdate(req);
}
