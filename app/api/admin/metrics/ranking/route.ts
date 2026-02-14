import { NextRequest, NextResponse } from "next/server";
import { listClients } from "@/data/clientsRepository";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

const MOCK_CLIENTS = [
  { slug: "griaule", name: "Griaule" },
  { slug: "testing-company", name: "Testing Company" },
  { slug: "cliente-x", name: "Cliente X" },
];

async function fetchSummary(slug: string, origin: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${origin}/api/empresas/${slug}/metrics/summary`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return { score: 0, status: "unknown" as const };
    const json = await res.json();
    return {
      score: typeof json.score === "number" ? json.score : 0,
      status:
        json.status === "healthy" || json.status === "warning" || json.status === "critical"
          ? json.status
          : "unknown",
    };
  } catch {
    return { score: 0, status: "unknown" as const };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    const msg = status === 401 ? "Nao autenticado" : "Sem permissao";
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

  const origin = req.nextUrl.origin;
  const results = await Promise.all(
    clients.map(async (c) => {
      const summary = await fetchSummary(c.slug, origin);
      return {
        slug: c.slug,
        name: c.name,
        score: summary.score,
        status: summary.status,
      };
    }),
  );
  results.sort((a, b) => b.score - a.score);
  const res = NextResponse.json({ companies: results }, { status: 200 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
