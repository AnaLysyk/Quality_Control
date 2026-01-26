import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { IS_PROD, SUPABASE_MOCK, SUPABASE_MOCK_RAW } from "@/lib/supabaseMock";

export const runtime = "nodejs";

type ClientItem = { id: string; name: string; slug?: string | null };

function summarizeDbError(err: unknown): { code?: string; message?: string } {
  if (!err || typeof err !== "object") return {};
  const rec = err as Record<string, unknown>;
  const code = typeof rec.code === "string" ? rec.code : undefined;
  const message = typeof rec.message === "string" ? rec.message : undefined;
  return { code, message };
}

function friendlyClientsLoadMessage(clienteErr: unknown, clientsErr: unknown): string {
  const c1 = summarizeDbError(clienteErr);
  const c2 = summarizeDbError(clientsErr);
  const codes = [c1.code, c2.code].filter(Boolean);

  // 42P01 = undefined_table
  if (codes.length && codes.every((c) => c === "42P01")) {
    return "Não foi possível carregar as empresas. A estrutura do banco não está pronta para esta tela.";
  }

  // 42703 = undefined_column
  if (codes.includes("42703")) {
    return "Não foi possível carregar as empresas. A estrutura do banco é incompatível com esta versão do app.";
  }

  // 401/403-like errors may come as messages rather than codes.
  const messages = [c1.message, c2.message].filter(Boolean).join(" | ").toLowerCase();
  if (messages.includes("invalid api key") || messages.includes("jwt") || messages.includes("unauthorized")) {
    return "Não foi possível carregar as empresas. A configuração do Supabase parece inválida.";
  }

  return "Não foi possível carregar as empresas. Tente novamente.";
}

async function fetchClientItems(supabase: ReturnType<typeof getSupabaseServer>, table: "cliente" | "clients") {
  try {
    // Some DBs keep companies in `cliente`, others in `clients`.
    // This endpoint must be tolerant to schema drift (different column names).
    const base = supabase.from(table);

    // 1) Preferred shape: company_name/name/slug/active
    let data: unknown[] | null = null;
    let error: unknown = null;

    {
      let query = base.select("id, company_name, name, slug, active").or("active.is.null,active.eq.true");

      // Prefer sorting by company_name when present; fall back to name.
      try {
        query = query.order("company_name", { ascending: true });
      } catch {
        query = query.order("name", { ascending: true });
      }

      const res = await query;
      data = (res.data as unknown[] | null) ?? null;
      error = res.error ?? null;
    }

    // 2) Fallback: schema incompatible (missing columns like active/company_name/slug)
    const { code } = summarizeDbError(error);
    if (error && code === "42703") {
      const res = await base.select("*");
      data = (res.data as unknown[] | null) ?? null;
      error = res.error ?? null;
    }

    if (error) return { items: [] as ClientItem[], error };

    const items: ClientItem[] = (data ?? [])
      .map((row) => {
        const rec = row as Record<string, unknown>;
        const rawId =
          (typeof rec.id === "string" || typeof rec.id === "number" ? rec.id : null) ??
          (typeof rec.client_id === "string" || typeof rec.client_id === "number" ? rec.client_id : null) ??
          (typeof rec.company_id === "string" || typeof rec.company_id === "number" ? rec.company_id : null) ??
          (typeof rec.uuid === "string" ? rec.uuid : null);

        const id = rawId == null ? "" : String(rawId);

        const slug =
          (typeof rec.slug === "string" ? rec.slug : null) ??
          (typeof rec.client_slug === "string" ? rec.client_slug : null) ??
          (typeof rec.company_slug === "string" ? rec.company_slug : null);

        const name =
          (typeof rec.company_name === "string" && rec.company_name) ||
          (typeof rec.name === "string" && rec.name) ||
          (typeof rec.client_name === "string" && rec.client_name) ||
          (typeof rec.company === "string" && rec.company) ||
          (typeof rec.nome === "string" && rec.nome) ||
          (typeof rec.nome_fantasia === "string" && rec.nome_fantasia) ||
          (typeof rec.fantasia === "string" && rec.fantasia) ||
          (typeof rec.razao_social === "string" && rec.razao_social) ||
          (typeof rec.razao === "string" && rec.razao) ||
          (typeof rec.empresa === "string" && rec.empresa) ||
          (typeof rec.companyTitle === "string" && rec.companyTitle) ||
          (typeof rec.display_name === "string" && rec.display_name) ||
          (typeof rec.title === "string" && rec.title) ||
          slug ||
          "";
        return { id, name, slug };
      })
      .filter((row) => row.id && row.name);

    if (items.length === 0 && (data ?? []).length > 0) {
      const sample = (data as unknown[])[0] as Record<string, unknown> | undefined;
      if (sample) {
        console.warn(`/api/public/clients: mapped 0 items from '${table}'. Sample keys:`, Object.keys(sample).slice(0, 30));
      }
    }

    return { items, error: null };
  } catch (error) {
    return { items: [] as ClientItem[], error };
  }
}

export async function GET() {
  try {
    if (SUPABASE_MOCK && !IS_PROD) {
      const items: ClientItem[] = [
        { id: "mock-client", name: "Cliente Mock", slug: "mock-client" },
      ];
      return NextResponse.json({ items }, { status: 200 });
    }

    if (SUPABASE_MOCK_RAW && IS_PROD) {
      console.warn("/api/public/clients: SUPABASE_MOCK ignored in production/Vercel");
    }

    let supabase: ReturnType<typeof getSupabaseServer>;
    try {
      supabase = getSupabaseServer();
    } catch (err) {
      console.error("/api/public/clients: supabase server misconfigured", err);
      return NextResponse.json(
        {
          items: [],
          message:
            "Servidor Supabase não configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const [clienteRes, clientsRes] = await Promise.all([
      fetchClientItems(supabase, "cliente"),
      fetchClientItems(supabase, "clients"),
    ]);

    // Merge and dedupe by id; prefer `cliente` name/slug when both exist.
    const byId = new Map<string, ClientItem>();
    for (const it of clientsRes.items) byId.set(it.id, it);
    for (const it of clienteRes.items) byId.set(it.id, it);

    const items = Array.from(byId.values());

    // If we couldn't query either table, surface it as an error (so the UI can show a helpful message).
    if (items.length === 0 && clienteRes.error && clientsRes.error) {
      console.error("/api/public/clients: failed querying both tables", {
        clienteError: clienteRes.error,
        clientsError: clientsRes.error,
      });
      return NextResponse.json(
        {
          items: [],
          message: friendlyClientsLoadMessage(clienteRes.error, clientsRes.error),
          hint:
            process.env.NODE_ENV === "production"
              ? undefined
              : "Em dev local: verifique .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) ou use SUPABASE_MOCK=true.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error("/api/public/clients: unexpected error", err);
    return NextResponse.json(
      { items: [], message: "Erro interno ao carregar empresas." },
      { status: 500 }
    );
  }
}
