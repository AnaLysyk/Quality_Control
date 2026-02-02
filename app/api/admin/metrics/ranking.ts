import { NextResponse } from "next/server";
import { listClients } from "@/data/clientsRepository";
import { getAccessContext } from "@/lib/auth/session";

const MOCK_CLIENTS = [
  { slug: "griaule", name: "Griaule" },
  { slug: "testing-company", name: "Testing Company" },
  { slug: "cliente-x", name: "Cliente X" },
];
// Helper to fetch summary for a company
async function fetchSummary(slug: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/empresas/${slug}/metrics/summary`, { cache: "no-store" });
    if (!res.ok) return { score: 100, status: "healthy" };
    const json = await res.json();
    return { score: typeof json.score === "number" ? json.score : 100, status: json.status || "healthy" };
  } catch {
    return { score: 100, status: "healthy" };
  }
}

export async function GET(req: Request) {
  // RBAC: only admin
  const access = await getAccessContext(req);
  const role = typeof access?.role === "string" ? access.role.toLowerCase() : "";
  const isAdmin = Boolean(access?.isGlobalAdmin || role === "admin");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let clients = [];
  try {
    clients = await listClients();
  } catch {
    // fallback para ambiente de dev/teste
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
    })
  );
  results.sort((a, b) => b.score - a.score);
  return NextResponse.json({ companies: results }, { status: 200 });
}
