import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { authenticateRequest } from "@/lib/jwtAuth";
import type { Release } from "@/types/release";

const STORE_PATH = path.join(process.cwd(), "data", "releases-manual.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

async function readStore(): Promise<Release[]> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Release[]) : [];
  } catch {
    return [];
  }
}

async function writeStore(releases: Release[]) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(releases, null, 2), "utf8");
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const releases = await readStore();
  const found = releases.find((r) => r.slug === slug);
  if (!found) return NextResponse.json({ message: "not found" }, { status: 404 });
  const total = found.stats.pass + found.stats.fail + found.stats.blocked + found.stats.notRun;
  return NextResponse.json({
    ...found,
    id: found.slug ?? found.id,
    metrics: {
      pass: found.stats.pass,
      fail: found.stats.fail,
      blocked: found.stats.blocked,
      not_run: found.stats.notRun,
      total,
      passRate: total > 0 ? Math.round((found.stats.pass / total) * 100) : 0,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { slug } = await params;
    const patch = await req.json();
    const releases = await readStore();
    const idx = releases.findIndex((r) => r.slug === slug);
    if (idx < 0) return NextResponse.json({ message: "not found" }, { status: 404 });

    const current = releases[idx];
    const updated: Release = {
      ...current,
      ...patch,
      // stats só atualiza se continuar sendo MANUAL
      stats: current.source === "MANUAL" ? { ...current.stats, ...(patch.stats ?? {}) } : current.stats,
      updatedAt: new Date().toISOString(),
    };

    releases[idx] = updated;
    await writeStore(releases);
    const total = updated.stats.pass + updated.stats.fail + updated.stats.blocked + updated.stats.notRun;
    return NextResponse.json({
      ...updated,
      id: updated.slug ?? updated.id,
      metrics: {
        pass: updated.stats.pass,
        fail: updated.stats.fail,
        blocked: updated.stats.blocked,
        not_run: updated.stats.notRun,
        total,
        passRate: total > 0 ? Math.round((updated.stats.pass / total) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("PATCH /releases-manual/[slug] error", error);
    return NextResponse.json({ message: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(_);
  if (!authUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const { slug } = await params;
    const releases = await readStore();
    const filtered = releases.filter((release) => release.slug !== slug);
    if (filtered.length === releases.length) {
      return NextResponse.json({ message: "not found" }, { status: 404 });
    }
    await writeStore(filtered);
    return NextResponse.json({ message: "deleted" });
  } catch (error) {
    console.error("DELETE /releases-manual/[slug] error", error);
    return NextResponse.json({ message: "Erro ao excluir" }, { status: 500 });
  }
}
