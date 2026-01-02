import { NextResponse } from "next/server";
import { getAllReleases, upsertRelease, type ReleaseEntry } from "@/release/data";
import { slugifyRelease } from "@/lib/slugifyRelease";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await getAllReleases();
  const target = all.find((r) => r.slug === slugifyRelease(slug));
  if (!target) {
    return NextResponse.json({ error: "Release não encontrada." }, { status: 404 });
  }
  return NextResponse.json({
    release: {
      id: target.slug,
      slug: target.slug,
      title: target.title,
      name: target.title,
      summary: target.summary,
      status: target.status ?? "ACTIVE",
      app: target.app ?? target.project,
      project: target.project,
      runId: target.runId,
      qaseProject: target.qaseProject,
      radis: target.radis,
      source: target.source ?? "API",
      createdAt: target.createdAt,
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = slugifyRelease(rawSlug);
  const body = await request.json().catch(() => ({}));

  const all = await getAllReleases();
  const existing = all.find((r) => r.slug === slug);
  if (!existing) {
    return NextResponse.json({ error: "Release não encontrada." }, { status: 404 });
  }

  const status = (body.status ?? existing.status ?? "ACTIVE") as ReleaseEntry["status"];
  const merged = {
    ...existing,
    title: (body.title ?? body.name ?? existing.title)?.toString(),
    summary: (body.summary ?? body.description ?? existing.summary)?.toString(),
    app: (body.app ?? body.project ?? existing.app ?? existing.project)?.toString(),
    project: (body.project ?? body.app ?? existing.project ?? existing.app)?.toString(),
    runId:
      body.runId !== undefined || body.run_id !== undefined
        ? Number(body.runId ?? body.run_id)
        : existing.runId,
    status,
    qaseProject: (body.qaseProject ?? body.project ?? existing.qaseProject)?.toString(),
    radis: (body.radis ?? existing.radis)?.toString(),
    source: existing.source ?? "API",
  };

  const saved = await upsertRelease({ ...merged, slug });

  const payload = {
    id: saved.slug,
    slug: saved.slug,
    title: saved.title,
    name: saved.title,
    summary: saved.summary,
    status: saved.status ?? "ACTIVE",
    app: saved.app ?? saved.project,
    project: saved.project,
    runId: saved.runId,
    qaseProject: saved.qaseProject,
    radis: saved.radis,
    source: saved.source ?? "API",
    createdAt: saved.createdAt,
  };

  return NextResponse.json({ release: payload });
}
