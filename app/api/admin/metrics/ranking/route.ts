import { NextRequest, NextResponse } from "next/server";
import { listClients } from "@/data/clientsRepository";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

const MOCK_CLIENTS = [
  { slug: "demo", name: "Demo" },
  { slug: "testing-company", name: "Testing Company" },
  { slug: "cliente-x", name: "Cliente X" },
];

async function fetchSummary(slug: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    const res = await fetch(`${baseUrl}/api/empresas/${slug}/metrics/summary`, { cache: "no-store" });
    if (!res.ok) return { score: 100, status: "healthy" as const };
    const json = await res.json();
    return {
      score: typeof json.score === "number" ? json.score : 100,
      status: json.status || "healthy",
    };
  } catch {
    return { score: 100, status: "healthy" as const };
  }
}

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const msg = status === 401 ? "Não autenticado" : "Sem permissão";
    return NextResponse.json({ error: msg }, { status });
  }

  let clients: { slug: string; name: string }[] = [];
  try {
    clients = await listClients();
  } catch {
    clients = MOCK_CLIENTS;
  }
  if (!clients || clients.length === 0) {
    clients = MOCK_CLIENTS;
  }

  const results = await Promise.all(
    clients.map(async (c) => {
      const summary = await fetchSummary(c.slug);
      return {
        slug: c.slug,
        name: c.name,
        score: summary.score,
        status: summary.status,
      };
    }),
  );
  results.sort((a, b) => b.score - a.score);

  return NextResponse.json({ companies: results }, { status: 200 });
}
