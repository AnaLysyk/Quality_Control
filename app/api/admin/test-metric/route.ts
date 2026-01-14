import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireGlobalAdmin } from "@/lib/rbac/requireGlobalAdmin";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

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
  let supabaseAdmin = null as ReturnType<typeof getSupabaseAdmin> | null;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    supabaseAdmin = null;
  }
  const admin = await requireGlobalAdmin(req, {
    token,
    supabaseAdmin: supabaseAdmin ?? undefined,
    mockAdmin: { id: "mock-admin", email: "ana.testing.company@gmail.com", token: "mock-token" },
  });
  if (!admin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  if (SUPABASE_MOCK) {
    return NextResponse.json(
      {
        totals: { approved: 120, failed: 30, neutral: 15, quality: 74 },
        clients: [
          { id: "mock-client", name: "Griaule", slug: "griaule", status: "ativo", releases: 8, approval: 92 },
          { id: "mock-b", name: "Acme", slug: "acme", status: "ativo", releases: 5, approval: 81 },
        ],
      },
      { status: 200 },
    );
  }

  // Em produção: tenta puxar empresas e calcular agregados simples (placeholders).
  const supabaseAdmin = getSupabaseAdmin();
  const { data: clients, error } = await supabaseAdmin
    .from("cliente")
    .select("id, company_name, slug, active")
    .order("company_name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar clientes:", error);
    return NextResponse.json(
      {
        totals: { approved: 0, failed: 0, neutral: 0, quality: 0 },
        clients: [],
      },
      { status: 200 },
    );
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

  return NextResponse.json(
    {
      totals: { approved: 0, failed: 0, neutral: 0, quality: 0 },
      clients: mapped,
    },
    { status: 200 },
  );
}
