import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { slugifyRelease } from "@/lib/slugifyRelease";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canCreateManualDefect, getMockRole, resolveDefectRole } from "@/lib/rbac/defects";
import type { Release, Stats } from "@/types/release";

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

function shouldCloseFromStats(stats: Partial<Stats>) {
  const fail = Math.max(0, Number(stats.fail ?? 0));
  const blocked = Math.max(0, Number(stats.blocked ?? 0));
  const notRun = Math.max(0, Number(stats.notRun ?? 0));
  return fail === 0 && blocked === 0 && notRun === 0;
}

export async function GET(req: Request) {
  const releases = await readStore();
  const url = new URL(req.url);
  const clientSlug = url.searchParams.get("clientSlug")?.trim() || null;
  const filtered = clientSlug ? releases.filter((r) => (r.clientSlug ?? null) === clientSlug) : releases;
  const normalized = filtered.map((r) => ({
    ...r,
    id: r.slug ?? r.id,
    metrics: {
      pass: r.stats.pass,
      fail: r.stats.fail,
      blocked: r.stats.blocked,
      not_run: r.stats.notRun,
      total: r.stats.pass + r.stats.fail + r.stats.blocked + r.stats.notRun,
      passRate:
        r.stats.pass + r.stats.fail + r.stats.blocked + r.stats.notRun > 0
          ? Math.round((r.stats.pass / (r.stats.pass + r.stats.fail + r.stats.blocked + r.stats.notRun)) * 100)
          : 0,
    },
  }));
  return NextResponse.json(normalized);
}

export async function POST(req: Request) {
  const authUser = await authenticateRequest(req);
  const mockRole = getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  try {
    const body = await req.json();
    const name = (body.name ?? "").toString().trim();
    const app = (body.app ?? "").toString().trim() || "SMART";
    const environments = Array.isArray(body.environments) ? body.environments.map((env: unknown) => String(env)) : [];
    const clientSlug = body.clientSlug ? String(body.clientSlug).trim() : null;
    const role = await resolveDefectRole(effectiveAuthUser, clientSlug);
    if (!canCreateManualDefect(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const stats = (body.stats ?? {}) as Partial<Stats>;
    const now = new Date().toISOString();
    const requestedClosedAt = typeof body.closedAt === "string" ? body.closedAt : null;
    const closedAt = requestedClosedAt ?? (shouldCloseFromStats(stats) ? now : null);

    if (!name) {
      return NextResponse.json({ message: "Nome obrigatorio" }, { status: 400 });
    }

    const release: Release = {
      id: crypto.randomUUID(),
      slug: body.slug ? slugifyRelease(body.slug) : slugifyRelease(name),
      name,
      app,
      environments,
      clientSlug: clientSlug && clientSlug.length > 0 ? clientSlug : null,
      source: "MANUAL",
      status: (body.status as Release["status"]) ?? "ACTIVE",
      stats: {
        pass: Math.max(0, Number(stats.pass ?? 0)),
        fail: Math.max(0, Number(stats.fail ?? 0)),
        blocked: Math.max(0, Number(stats.blocked ?? 0)),
        notRun: Math.max(0, Number(stats.notRun ?? 0)),
      },
      observations: body.observations ? String(body.observations) : undefined,
      closedAt,
      createdAt: now,
      updatedAt: now,
    };

    const releases = await readStore();
    const filtered = releases.filter((r) => r.slug !== release.slug);
    filtered.unshift(release);
    await writeStore(filtered);

    const total = release.stats.pass + release.stats.fail + release.stats.blocked + release.stats.notRun;
    const payload = {
      ...release,
      id: release.slug ?? release.id,
      metrics: {
        pass: release.stats.pass,
        fail: release.stats.fail,
        blocked: release.stats.blocked,
        not_run: release.stats.notRun,
        total,
        passRate: total > 0 ? Math.round((release.stats.pass / total) * 100) : 0,
      },
    };

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error("POST /releases-manual error", error);
    return NextResponse.json({ message: "Erro ao salvar release manual" }, { status: 500 });
  }
}
