import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { fetchBackend } from "@/lib/backendProxy";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const backendRes = await fetchBackend(request, `/projects${url.search}`);
  if (backendRes) {
    const json = (await backendRes.json().catch(() => null)) as unknown;
    if (!backendRes.ok) {
      const message =
        (asRecord(asRecord(json)?.error)?.message as string) ||
        (asRecord(json)?.message as string) ||
        "Erro ao consultar backend";
      return NextResponse.json({ error: { message } }, { status: backendRes.status });
    }

    const directList = Array.isArray(asRecord(json)?.data) ? (asRecord(json)?.data as unknown[]) : null;
    const result = directList ? { entities: directList } : asRecord(json)?.result;
    const entities = Array.isArray(asRecord(result)?.entities) ? (asRecord(result)?.entities as unknown[]) : [];
    const data = entities
      .map((p) => {
        const rec = asRecord(p) ?? {};
        const code = typeof rec.code === "string" ? rec.code : typeof rec.project === "string" ? rec.project : "";
        const title = typeof rec.title === "string" ? rec.title : typeof rec.name === "string" ? rec.name : code;
        return code ? { code, title } : null;
      })
      .filter(Boolean);

    return NextResponse.json({ data }, { status: 200 });
  }

  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: { message: "NÃ£o autorizado" } }, { status: 401 });

  if (!QASE_TOKEN) {
    return NextResponse.json({ data: [], warning: "QASE_API_TOKEN ausente" }, { status: 200 });
  }

  const res = await fetch(`${QASE_BASE_URL}/v1/project`, {
    headers: { Token: QASE_TOKEN, Accept: "application/json" },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message = asRecord(json)?.error && asRecord(asRecord(json)?.error)?.message;
    return NextResponse.json({ error: { message: (message as string) || "Erro ao consultar Qase" } }, { status: res.status });
  }

  const result = asRecord(json)?.result;
  const entities = Array.isArray(asRecord(result)?.entities) ? (asRecord(result)?.entities as unknown[]) : [];
  const data = entities
    .map((p) => {
      const rec = asRecord(p) ?? {};
      const code = typeof rec.code === "string" ? rec.code : typeof rec.project === "string" ? rec.project : "";
      const title = typeof rec.title === "string" ? rec.title : typeof rec.name === "string" ? rec.name : code;
      return code ? { code, title } : null;
    })
    .filter(Boolean);

  return NextResponse.json({ data }, { status: 200 });
}
