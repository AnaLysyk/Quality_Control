import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";

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

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });

  const url = new URL(request.url);
  const project = normalizeString(url.searchParams.get("project")) || DEFAULT_PROJECT;
  if (!project) return NextResponse.json({ error: { message: "Missing project" } }, { status: 400 });

  if (!QASE_TOKEN) {
    return NextResponse.json({ data: [], warning: "QASE_API_TOKEN ausente" }, { status: 200 });
  }

  const res = await fetch(`${QASE_BASE_URL}/v1/run/${encodeURIComponent(project)}?limit=50`, {
    headers: { Token: QASE_TOKEN, Accept: "application/json" },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message = asRecord(json)?.error && asRecord(asRecord(json)?.error)?.message;
    return NextResponse.json({ error: { message: (message as string) || "Erro ao consultar Qase" } }, { status: res.status });
  }

  const entities = (asRecord(asRecord(json)?.result)?.entities as unknown[]) || [];
  return NextResponse.json({ data: entities }, { status: 200 });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const rec = asRecord(body) ?? {};
  const project = normalizeString(rec.project) || DEFAULT_PROJECT;
  const title = normalizeString(rec.title);
  const description = normalizeString(rec.description) || "";
  const customType = normalizeString(rec.custom_type);

  if (!project || !title) {
    return NextResponse.json({ error: { message: "Missing project or title" } }, { status: 400 });
  }

  if (!QASE_TOKEN) {
    return NextResponse.json({ error: { message: "QASE_API_TOKEN ausente" } }, { status: 503 });
  }

  const payload: Record<string, unknown> = {
    title,
    description,
  };
  if (customType) {
    payload.custom_fields = { custom_type: customType };
  }

  const res = await fetch(`${QASE_BASE_URL}/v1/run/${encodeURIComponent(project)}`, {
    method: "POST",
    headers: { Token: QASE_TOKEN, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message = asRecord(json)?.error && asRecord(asRecord(json)?.error)?.message;
    return NextResponse.json({ error: { message: (message as string) || "Erro ao criar run" } }, { status: res.status });
  }

  return NextResponse.json({ data: asRecord(json)?.result ?? null }, { status: 200 });
}
