import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_MOCK } from "@/lib/supabaseMock";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice("bearer ".length).trim();
    if (token) return token;
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)(sb-access-token|auth_token)=([^;]+)/i);
  return match?.[2] ? decodeURIComponent(match[2]) : null;
}

function sanitizePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function createSupabaseUserClient(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function createSupabaseAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createSupabaseAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as unknown;
  const record = (body ?? null) as Record<string, unknown> | null;

  const currentPassword = sanitizePassword(record?.currentPassword);
  const newPassword = sanitizePassword(record?.newPassword);

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Senha atual e nova senha sao obrigatorias" }, { status: 400 });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Nova senha deve ter entre 8 e 128 caracteres" }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "Nova senha deve ser diferente da atual" }, { status: 400 });
  }

  if (SUPABASE_MOCK) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Configuracao do Supabase incompleta" }, { status: 500 });
  }

  const token = extractToken(req);
  if (!token) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const userClient = createSupabaseUserClient(token);
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "Sessao invalida" }, { status: 401 });
  }

  const authUser = authData.user;
  const email = authUser.email;
  if (!email) {
    return NextResponse.json({ error: "Conta sem email associado" }, { status: 400 });
  }

  const anonClient = createSupabaseAnonClient();
  const { error: passwordCheckError } = await anonClient.auth.signInWithPassword({ email, password: currentPassword });
  if (passwordCheckError) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, { password: newPassword });
  if (updateError) {
    return NextResponse.json({ error: "Nao foi possivel atualizar a senha" }, { status: 500 });
  }

  try {
    const passwordHash = createHash("sha256").update(newPassword).digest("hex");
    const { error: updateUserRowError } = await adminClient
      .from("users")
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq("auth_user_id", authUser.id);

    if (updateUserRowError) {
      const { error: legacyKeyError } = await adminClient
        .from("users")
        .update({ password_hash: passwordHash })
        .eq("auth_user_id", authUser.id);
      if (legacyKeyError) {
        await adminClient
          .from("users")
          .update({ password_hash: passwordHash })
          .eq("id", authUser.id);
      }
    }
  } catch {
    /* ignore sync issues */
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
