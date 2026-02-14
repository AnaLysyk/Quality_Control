import { NextRequest, NextResponse } from "next/server";

import { listClients, type ClientEntry } from "@/data/clientsRepository";
import { getAccessContext } from "@/lib/auth/session";

type SummaryStatus = "healthy" | "warning" | "critical" | "unknown";
type Summary = { score: number; status: SummaryStatus };

const FALLBACK_SUMMARY: Summary = { score: 0, status: "unknown" };

const MOCK_CLIENTS: ClientEntry[] = [
  { slug: "griaule", name: "Griaule", active: true },
  { slug: "testing-company", name: "Testing Company", active: true },
  { slug: "cliente-x", name: "Cliente X", active: true },
];

function resolveBaseUrl(origin: string) {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase;
  return origin;
}

async function fetchSummary(slug: string, origin: string): Promise<Summary> {
  const base = resolveBaseUrl(origin);
  if (!base) return FALLBACK_SUMMARY;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const url = new URL(`/api/empresas/${encodeURIComponent(slug)}/metrics/summary`, base);
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return FALLBACK_SUMMARY;
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const score = typeof json?.score === "number" ? json.score : 0;
    const status = typeof json?.status === "string" ? json.status : "unknown";
    if (status === "healthy" || status === "warning" || status === "critical") {
      return { score, status };
    }
    return { score, status: "unknown" };
  } catch {
    return FALLBACK_SUMMARY;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const role = typeof access.role === "string" ? access.role.toLowerCase() : "";
  const isAdmin = access.isGlobalAdmin || role === "admin";

  let clients: ClientEntry[] = [];
  try {
    clients = await listClients();
  } catch {
    clients = MOCK_CLIENTS;
  }
  if (!clients.length) {
    clients = MOCK_CLIENTS;
  }

  const sanitized = clients
    .filter((client) => typeof client?.slug === "string" && client.slug.trim().length > 0 && client.active !== false)
    .map((client) => ({
      slug: client.slug.trim(),
      name: client.name || "Empresa",
    }));

  const allowedSlugs = new Set((access.companySlugs ?? []).map((slug) => slug.toLowerCase()));
  const visibleClients = isAdmin
    ? sanitized
    : sanitized.filter((client) => allowedSlugs.has(client.slug.toLowerCase()));

  if (!visibleClients.length) {
    const res = NextResponse.json({ companies: [] }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const origin = req.nextUrl.origin;
  const results = await Promise.all(
    visibleClients.map(async (client) => {
      const summary = await fetchSummary(client.slug, origin);
      return {
        slug: client.slug,
        name: client.name,
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
