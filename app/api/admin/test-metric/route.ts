import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { apiFail, apiOk } from "@/lib/apiResponse";
import { SUPABASE_MOCK } from "@/lib/supabaseMock";


function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/auth_token=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function GET(req: NextRequest) {
  const token = extractToken(req);
  const supabaseAdmin: ReturnType<typeof getSupabaseAdmin> | null = (() => {
    try {
      return getSupabaseAdmin();
    } catch {
      return null;
    }
  })();
  const { admin, status } = await requireGlobalAdminWithStatus(req, {
    token,
    supabaseAdmin: supabaseAdmin ?? undefined,
    mockAdmin: { id: "mock-admin", email: "ana.testing.company@gmail.com", token: "mock-token" },
  });
  if (!admin) {
    const legacy = { error: status === 401 ? "Nao autenticado" : "Sem permissao" };
    return apiFail(req, legacy.error, {
      status,
      code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
      extra: legacy,
    });
  }

  if (SUPABASE_MOCK) {
    const payload = {
      totals: { approved: 120, failed: 30, neutral: 15, quality: 74 },
      clients: [
        { id: "mock-client", name: "Griaule", slug: "griaule", status: "ativo", releases: 8, approval: 92 },
        { id: "mock-b", name: "Acme", slug: "acme", status: "ativo", releases: 5, approval: 81 },
      ],
    };
    return apiOk(req, payload, "OK", { extra: payload });
  }

  if (!supabaseAdmin) {
    const legacy = { error: "Supabase admin nao configurado" };
    return apiFail(req, legacy.error, { status: 500, code: "SUPABASE_NOT_CONFIGURED", extra: legacy });
  }

  // Em produção: tenta puxar empresas e calcular agregados simples (placeholders).
  const { data: clients, error } = await supabaseAdmin
    .from("cliente")
    .select("id, company_name, slug, active")
    .order("company_name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar clientes:", error);
    const payload = {
      totals: { approved: 0, failed: 0, neutral: 0, quality: 0 },
      clients: [],
    };
    return apiOk(req, payload, "OK", { extra: payload });
  }

  const mapped =
    clients?.map((c) => ({
      id: c.id,
      name: c.company_name ?? "Empresa",
      slug: c.slug ?? "",
      status: c.active === false ? "inativo" : "ativo",
      releases: null,
      approval: null,
    })) ?? [];

  const payload = {
    totals: { approved: 0, failed: 0, neutral: 0, quality: 0 },
    clients: mapped,
  };
  return apiOk(req, payload, "OK", { extra: payload });
}
