import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { hasCapability, type Capability } from "@/lib/permissions";
import { canUsePersistentJsonStore, readPersistentJson, writePersistentJson } from "@/database/persistentJsonStore";
import { syncReleaseManualToBrain } from "@/lib/brain-sync";

type ManualRelease = {
  id: string;
  title: string;
  description?: string | null;
  companyId: string;
  status: "open" | "closed";
  createdAt: string;
};

const STORE_KEY = "qc:release_manual_store:v1";
const USE_PERSISTENT_STORE = canUsePersistentJsonStore();
let memoryStore: ManualRelease[] = [];

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
    hasCapability((user.capabilities ?? []) as Capability[], "release:read") ||
    hasRole(user, ["leader_tc", "technical_support", "empresa", "company_user", "testing_company_user"])
  );
}

function canWrite(user: AuthUser) {
  return (
    user.isGlobalAdmin ||
    hasCapability((user.capabilities ?? []) as Capability[], "release:write") ||
    hasRole(user, ["leader_tc", "technical_support", "empresa"])
  );
}

function ensureCompanyAccess(user: AuthUser, companyId: string) {
  if (user.isGlobalAdmin) return true;
  if (user.companyId && user.companyId === companyId) return true;
  return false;
}

async function readStore(): Promise<ManualRelease[]> {
  if (USE_PERSISTENT_STORE) {
    const persisted = await readPersistentJson<ManualRelease[]>(STORE_KEY, []);
    return Array.isArray(persisted) ? persisted : [];
  }

  return memoryStore;
}

async function writeStore(items: ManualRelease[]) {
  if (USE_PERSISTENT_STORE) {
    const ok = await writePersistentJson(STORE_KEY, items);
    if (ok) return;
  }

  memoryStore = items;
}

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
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

  syncReleaseManualToBrain({
    id: release.id,
    title: release.title,
    description: release.description,
    status: release.status,
    companyId: release.companyId,
  }).catch(() => {});

  return NextResponse.json(release, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!canRead(user)) {
    return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
  }

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId e obrigatório" }, { status: 400 });
  }
  if (!ensureCompanyAccess(user, companyId)) {
    return NextResponse.json({ error: "Acesso proibido" }, { status: 403 });
  }
  const releases = await readStore();
  return NextResponse.json(releases.filter((r) => r.companyId === companyId));
}

