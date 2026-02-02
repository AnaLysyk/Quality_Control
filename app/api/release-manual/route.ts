import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { hasCapability } from "@/lib/permissions";

type ManualRelease = {
  id: string;
  title: string;
  description?: string | null;
  companyId: string;
  status: "open" | "closed";
  createdAt: string;
};

const STORE_PATH = path.join(process.cwd(), "data", "release-manual-store.json");

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase();
}

function hasRole(user: AuthUser, roles: string[]) {
  const role = normalizeRole(user.role);
  return roles.includes(role);
}

function canRead(user: AuthUser) {
  return (
    user.isGlobalAdmin ||
    hasCapability(user.capabilities as any, "release:read") ||
    hasRole(user, ["admin", "company", "user", "viewer"])
  );
}

function canWrite(user: AuthUser) {
  return (
    user.isGlobalAdmin ||
    hasCapability(user.capabilities as any, "release:write") ||
    hasRole(user, ["admin", "company"])
  );
}

function ensureCompanyAccess(user: AuthUser, companyId: string) {
  if (user.isGlobalAdmin) return true;
  if (user.companyId && user.companyId === companyId) return true;
  return false;
}

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "[]", "utf8");
  }
}

async function readStore(): Promise<ManualRelease[]> {
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ManualRelease[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStore(items: ManualRelease[]) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(items, null, 2), "utf8");
}

// POST: Cria um novo release manual para uma empresa
export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  if (!canWrite(user)) {
    return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
  }

  const data = await req.json().catch(() => null);
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  const description = typeof data?.description === "string" ? data.description.trim() : "";
  const companyId = typeof data?.companyId === "string" ? data.companyId.trim() : "";

  if (!title || !companyId) {
    return NextResponse.json({ error: "title e companyId sao obrigatorios" }, { status: 400 });
  }
  if (!ensureCompanyAccess(user, companyId)) {
    return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
  }

  const release: ManualRelease = {
    id: randomUUID(),
    title,
    description: description || null,
    companyId,
    status: "open",
    createdAt: new Date().toISOString(),
  };

  const releases = await readStore();
  releases.unshift(release);
  await writeStore(releases);

  return NextResponse.json(release, { status: 201 });
}

// GET: Lista todos os releases manuais de uma empresa
export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  if (!canRead(user)) {
    return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
  }

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId e obrigatorio" }, { status: 400 });
  }
  if (!ensureCompanyAccess(user, companyId)) {
    return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
  }
  const releases = await readStore();
  return NextResponse.json(releases.filter((r) => r.companyId === companyId));
}
