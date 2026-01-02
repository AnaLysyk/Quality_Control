import { NextResponse } from "next/server";
import store, { nextId } from "./store";
import type { Status } from "./types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project")?.toUpperCase();
  const runId = Number(searchParams.get("runId"));

  if (!project || !Number.isFinite(runId)) {
    return NextResponse.json({ message: "project e runId sao obrigatorios" }, { status: 400 });
  }

  const items = store.filter((c) => c.project === project && c.run_id === runId).sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  if (!items.length) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });

  const project = (body.project as string | undefined)?.toUpperCase();
  const runId = Number(body.runId);
  const title = (body.title as string | undefined)?.trim();
  const status = (body.status as string | undefined)?.toUpperCase() as Status;

  if (!project || !Number.isFinite(runId) || !title || !status || !["PASS", "FAIL", "BLOCKED", "NOT_RUN"].includes(status)) {
    return NextResponse.json({ message: "Campos obrigatorios: project, runId, title, status valido" }, { status: 400 });
  }

  const card = {
    id: nextId(),
    project,
    run_id: runId,
    case_id: body.case_id ?? null,
    title,
    status,
    bug: body.bug ?? null,
    link: body.link ?? null,
    created_at: new Date().toISOString(),
  };
  store.push(card);
  return NextResponse.json(card, { status: 201 });
}
