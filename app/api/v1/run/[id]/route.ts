import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { fetchBackend } from "@/lib/backendProxy";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";
const DEFAULT_PROJECT =
  process.env.NEXT_PUBLIC_QASE_DEFAULT_PROJECT ||
  process.env.NEXT_PUBLIC_QASE_PROJECT ||
  process.env.QASE_DEFAULT_PROJECT ||
  "";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const backendRes = await fetchBackend(request, `/runs/${encodeURIComponent(id)}${url.search}`);
  if (backendRes) {
    const json = (await backendRes.json().catch(() => null)) as unknown;
    if (!backendRes.ok) {
      const message =
        (asRecord(asRecord(json)?.error)?.message as string) ||
        (asRecord(json)?.message as string) ||
        "Erro ao consultar backend";
      return NextResponse.json({ error: { message } }, { status: backendRes.status });
    }
    return NextResponse.json({ data: asRecord(json)?.result ?? null }, { status: 200 });
  }

  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: { message: "NÃ£o autorizado" } }, { status: 401 });

  const project = (url.searchParams.get("project") || DEFAULT_PROJECT || "").trim();
  if (!project) return NextResponse.json({ error: { message: "Missing project" } }, { status: 400 });

  if (!QASE_TOKEN) {
    return NextResponse.json({ data: null, warning: "QASE_API_TOKEN ausente" }, { status: 200 });
  }

  const res = await fetch(`${QASE_BASE_URL}/v1/run/${encodeURIComponent(project)}/${encodeURIComponent(id)}`, {
    headers: { Token: QASE_TOKEN, Accept: "application/json" },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message = asRecord(json)?.error && asRecord(asRecord(json)?.error)?.message;
    return NextResponse.json({ error: { message: (message as string) || "Erro ao consultar run" } }, { status: res.status });
  }

  return NextResponse.json({ data: asRecord(json)?.result ?? null }, { status: 200 });
}
