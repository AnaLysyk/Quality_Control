import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";

const QASE_BASE_URL = (process.env.QASE_BASE_URL || "https://api.qase.io").replace(/\/(v1|v2)\/?$/, "");
const QASE_TOKEN = process.env.QASE_TOKEN || process.env.QASE_API_TOKEN || "";

const PROJECTS_FALLBACK = (process.env.NEXT_PUBLIC_QASE_PROJECTS || process.env.QASE_PROJECTS || "SFQ,PRINT,BOOKING,CDS,GMT")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

type Defect = {
  id: number;
  title: string;
  status?: string;
  severity?: string | number;
  description?: string;
  project?: string;
  project_code?: string;
};

function normalizeDefectList(entities: unknown[], projectCode?: string): Defect[] {
  return entities
    .map((d) => {
      const rec = asRecord(d) ?? {};
      const idRaw = rec.id ?? rec.defect_id;
      const id = Number(idRaw);
      if (!Number.isFinite(id)) return null;

      const project =
        (typeof rec.project === "string" ? rec.project : null) ||
        (typeof rec.project_code === "string" ? rec.project_code : null) ||
        projectCode ||
        undefined;

      return {
        id,
        title:
          (typeof rec.title === "string" ? rec.title : null) ||
          (typeof rec.name === "string" ? rec.name : null) ||
          `Defect ${id}`,
        status: typeof rec.status === "string" ? rec.status : undefined,
        severity:
          (typeof rec.severity === "string" ? rec.severity : null) ??
          (typeof rec.severity_name === "string" ? rec.severity_name : null) ??
          undefined,
        description: typeof rec.description === "string" ? rec.description : undefined,
        project,
        project_code: project,
      } satisfies Defect;
    })
    .filter(Boolean) as Defect[];
}

async function fetchProjectDefects(projectCode: string): Promise<Defect[]> {
  const res = await fetch(`${QASE_BASE_URL}/v1/defect/${encodeURIComponent(projectCode)}?limit=100&offset=0`, {
    headers: { Token: QASE_TOKEN, Accept: "application/json" },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    return [];
  }

  const entities = (asRecord(asRecord(json)?.result)?.entities as unknown[]) || [];
  return normalizeDefectList(entities, projectCode);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ success: false, error: { message: "Nao autorizado" } }, { status: 401 });

  const project = normalizeString(url.searchParams.get("project")) || "ALL";

  if (!QASE_TOKEN) {
    return NextResponse.json({ success: true, data: [], warning: "QASE_API_TOKEN ausente" }, { status: 200 });
  }

  const projects = project.toUpperCase() === "ALL" ? PROJECTS_FALLBACK : [project];
  const lists = await Promise.all(projects.map((p) => fetchProjectDefects(p)));
  const merged = lists.flat();

  return NextResponse.json({ success: true, data: merged }, { status: 200 });
}
