import { NextResponse } from "next/server";
// Importa fs e path só em ambiente Node/server
let fs: typeof import("fs/promises") | undefined;
let path: typeof import("path") | undefined;
if (typeof process !== "undefined" && process.release?.name === "node") {
  fs = require("fs/promises");
  path = require("path");
}
import { authenticateRequest } from "@/lib/jwtAuth";
import { evaluateQualityGate } from "@/lib/quality";
import { canDeleteManualDefect, canEditManualDefect, getMockRole, resolveDefectRole } from "@/lib/rbac/defects";
import type { Release } from "@/types/release";
import { normalizeDefectStatus, resolveClosedAt } from "@/lib/defectNormalization";

const STORE_PATH = path && path.join(process.cwd(), "data", "releases-manual.json");

async function ensureStore() {
  if (!fs || !path || !STORE_PATH) return;
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

async function readStore(): Promise<Release[]> {
  if (!fs || !STORE_PATH) return [];
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
  if (!fs || !STORE_PATH) return;
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(releases, null, 2), "utf8");
}

function isFinalStatus(status?: string) {
  const value = (status ?? "").trim().toUpperCase();
  return value === "FINALIZADA" || value === "FINALIZED" || value === "FINALIZADO";
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const releases = await readStore();
  const found = releases.find((r) => r.slug === slug);
  if (!found) return NextResponse.json({ message: "Nao encontrado" }, { status: 404 });
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
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });

  try {
    const { slug } = await params;
    const patch = await req.json();
    const releases = await readStore();
    const idx = releases.findIndex((r) => r.slug === slug);
    if (idx < 0) return NextResponse.json({ message: "Nao encontrado" }, { status: 404 });

    const current = releases[idx];
    const role = await resolveDefectRole(effectiveAuthUser, current.clientSlug ?? null);
    if (!canEditManualDefect(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Normaliza status recebido
    const statusToSave = normalizeDefectStatus(patch.status ?? current.status);
    const closedAtToSave = resolveClosedAt(statusToSave, patch.closedAt ?? current.closedAt, current.updatedAt ?? current.closedAt ?? null);

    const nextStats =
      current.source === "MANUAL"
        ? { ...current.stats, ...(patch.stats ?? {}) }
        : current.stats;

    const gate = evaluateQualityGate(nextStats);
    if (isFinalStatus(patch.status) && gate.status === "failed") {
      return NextResponse.json({ message: "Quality gate bloqueado" }, { status: 403 });
    }

    // --- Run link/unlink logic ---
    let runSlugToSave = current.runSlug;
    let runNameToSave = current.runName;
    if (patch.hasOwnProperty("runSlug")) {
      if (patch.runSlug === null) {
        runSlugToSave = undefined;
        runNameToSave = undefined;
      } else {
        runSlugToSave = patch.runSlug;
        if (patch.hasOwnProperty("runName")) {
          runNameToSave = patch.runName;
        }
      }
    }

    const updated: Release = {
      ...current,
      ...patch,
      runSlug: runSlugToSave,
      runName: runNameToSave,
      status: statusToSave,
      stats: nextStats,
      closedAt: closedAtToSave,
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

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });

  try {
    const { slug } = await params;
    const releases = await readStore();
    const target = releases.find((release) => release.slug === slug);
    if (!target) {
      return NextResponse.json({ message: "Nao encontrado" }, { status: 404 });
    }
    const role = await resolveDefectRole(effectiveAuthUser, target.clientSlug ?? null);
    if (!canDeleteManualDefect(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const filtered = releases.filter((release) => release.slug !== slug);
    await writeStore(filtered);
    return NextResponse.json({ message: "deleted" });
  } catch (error) {
    console.error("DELETE /releases-manual/[slug] error", error);
    return NextResponse.json({ message: "Erro ao excluir" }, { status: 500 });
  }
}
