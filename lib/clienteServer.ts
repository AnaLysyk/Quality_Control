import "server-only";

import { getSupabaseServer } from "@/lib/supabaseServer";
import mockClients from "@/data/mock-clients.json";
import { SUPABASE_MOCK } from "@/lib/supabaseMock";

export type ClienteSummary = {
  id: string;
  slug: string;
  name: string;
};

export async function getClienteBySlug(slug: string): Promise<ClienteSummary | null> {
  const normalized = (slug || "").trim();
  if (!normalized) return null;

  // Mock fallback para ambiente de teste/dev
  if (SUPABASE_MOCK) {
    const client = (mockClients as any[]).find((c) => c.slug === normalized);
    if (!client) return null;
    return {
      id: client.id,
      slug: client.slug,
      name: client.company_name || client.name || client.slug,
    };
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("cliente")
    .select("id,slug,company_name,name")
    .eq("slug", normalized)
    .maybeSingle();

  if (error || !data) return null;

  const id = typeof (data as any).id === "string" ? (data as any).id : "";
  const slugValue = typeof (data as any).slug === "string" ? (data as any).slug : "";
  const nameValue =
    (typeof (data as any).company_name === "string" && (data as any).company_name) ||
    (typeof (data as any).name === "string" && (data as any).name) ||
    slugValue;

  if (!id || !slugValue) return null;
  return { id, slug: slugValue, name: nameValue };
}
