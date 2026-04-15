import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";

import { listLocalCompanies, listLocalLinksForUser, listLocalUsers } from "@/lib/auth/localStore";
import { getJsonStoreDir } from "@/data/jsonStorePath";
import { getJwtSecret } from "@/lib/auth/jwtSecret";
import { prisma } from "@/lib/prismaClient";
import { shouldUsePostgresPersistence } from "@/lib/persistenceMode";
import { getRedis } from "@/lib/redis";

const USE_POSTGRES = shouldUsePostgresPersistence();

type CompanyDocumentKind = "file" | "link";
type DocumentHistoryAction = "created" | "deleted";

export type CompanyDocumentItem = {
  id: string;
  companySlug: string;
  kind: CompanyDocumentKind;
  title: string;
  description?: string | null;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storagePath?: string | null;
  createdAt: string;
  createdBy?: string | null;
  createdByName?: string | null;
};

type DocumentHistoryEvent = {
  id: string;
  companySlug: string;
  documentId: string;
  action: DocumentHistoryAction;
  kind: CompanyDocumentKind;
  title: string;
  description?: string | null;
  url?: string | null;
  fileName?: string | null;
  createdAt: string;
  actorId?: string | null;
};

type AuthContext = {
  userId: string;
  companySlugs: string[];
  isGlobalAdmin: boolean;
  role: string | null;
  companyRole: string | null;
  permissionRole: string | null;
};

const STORE_PATH = path.join(getJsonStoreDir(), "company-documents-store.json");
const HISTORY_PATH = path.join(getJsonStoreDir(), "company-documents-history.json");
const LOCAL_UPLOAD_ROOT = path.join(getJsonStoreDir(), "company-documents-files");

function pgRowToDocItem(row: {
  id: string; companySlug: string; kind: string; title: string;
  description?: string | null; url?: string | null; fileName?: string | null;
  mimeType?: string | null; sizeBytes?: number | null; storagePath?: string | null;
  createdAt: Date; createdBy?: string | null; createdByName?: string | null;
}): CompanyDocumentItem {
  return {
    id: row.id,
    companySlug: row.companySlug,
    kind: row.kind as CompanyDocumentKind,
    title: row.title,
    description: row.description ?? null,
    url: row.url ?? null,
    fileName: row.fileName ?? null,
    mimeType: row.mimeType ?? null,
    sizeBytes: row.sizeBytes ?? null,
    storagePath: row.storagePath ?? null,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy ?? null,
    createdByName: row.createdByName ?? null,
  };
}

function sanitizeSlug(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 80);
}

function sanitizeFilename(raw: string) {
  const trimmed = raw.trim().slice(0, 160);
  return trimmed.replace(/[\\/\0]/g, "_");
}

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify({ items: [] }, null, 2), "utf8");
  }
}

async function readStore(): Promise<{ items: CompanyDocumentItem[] }> {
  if (USE_POSTGRES) {
    const rows = await prisma.companyDocument.findMany({ orderBy: { createdAt: "desc" } });
    return { items: rows.map(pgRowToDocItem) };
  }
  await ensureStore();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as { items?: unknown };
    const items = Array.isArray(parsed?.items) ? (parsed.items as CompanyDocumentItem[]) : [];
    return { items };
  } catch {
    return { items: [] };
  }
}

async function writeStore(next: { items: CompanyDocumentItem[] }) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
}

async function ensureHistoryStore() {
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  try {
    await fs.access(HISTORY_PATH);
  } catch {
    await fs.writeFile(HISTORY_PATH, JSON.stringify({ items: [] }, null, 2), "utf8");
  }
}

async function readHistory(): Promise<{ items: DocumentHistoryEvent[] }> {
  if (USE_POSTGRES) {
    const rows = await prisma.documentHistoryEvent.findMany({ orderBy: { createdAt: "desc" } });
    return {
      items: rows.map((r) => ({
        id: r.id,
        companySlug: r.companySlug,
        documentId: r.documentId ?? "",
        action: r.action as DocumentHistoryAction,
        kind: r.kind as CompanyDocumentKind,
        title: r.title,
        description: r.description ?? null,
        url: r.url ?? null,
        fileName: r.fileName ?? null,
        createdAt: r.createdAt.toISOString(),
        actorId: r.actorId ?? null,
      })),
    };
  }
  await ensureHistoryStore();
  try {
    const raw = await fs.readFile(HISTORY_PATH, "utf8");
    const parsed = JSON.parse(raw) as { items?: unknown };
    const items = Array.isArray(parsed?.items) ? (parsed.items as DocumentHistoryEvent[]) : [];
    return { items };
  } catch {
    return { items: [] };
  }
}

async function writeHistory(next: { items: DocumentHistoryEvent[] }) {
  await ensureHistoryStore();
  await fs.writeFile(HISTORY_PATH, JSON.stringify(next, null, 2), "utf8");
}

async function appendHistoryEvent(
  action: DocumentHistoryAction,
  item: CompanyDocumentItem,
  actorId?: string | null,
) {
  if (USE_POSTGRES) {
    await prisma.documentHistoryEvent.create({
      data: {
        id: crypto.randomUUID(),
        companySlug: item.companySlug,
        documentId: item.id,
        action,
        kind: item.kind,
        title: item.title,
        description: item.description ?? null,
        url: item.url ?? null,
        fileName: item.fileName ?? null,
        createdAt: new Date(),
        actorId: actorId ?? null,
      },
    });
    return;
  }
  const history = await readHistory();
  const event: DocumentHistoryEvent = {
    id: crypto.randomUUID(),
    companySlug: item.companySlug,
    documentId: item.id,
    action,
    kind: item.kind,
    title: item.title,
    description: item.description ?? null,
    url: item.url ?? null,
    fileName: item.fileName ?? null,
    createdAt: new Date().toISOString(),
    actorId: actorId ?? null,
  };
  history.items.unshift(event);
  await writeHistory(history);
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    if (key === name) {
      const value = rest.join("=");
      return value ? decodeURIComponent(value) : "";
    }
  }
  return null;
}

async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  const cookieToken = readCookieValue(cookieHeader, "access_token") ?? readCookieValue(cookieHeader, "auth_token");
  const token = bearer || cookieToken;
  if (token) {
    const secret = getJwtSecret();
    if (!secret) {
      const redis = getRedis();
      const raw = await redis.get<string>(`session:${token}`);
      if (!raw) return null;
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const userId = (parsed as { userId?: string; id?: string }).userId ?? (parsed as { id?: string }).id;
        if (!userId) return null;
        const isGlobalAdmin = (parsed as { isGlobalAdmin?: boolean }).isGlobalAdmin === true;
        const role = typeof (parsed as { role?: unknown }).role === "string" ? String((parsed as { role?: string }).role) : null;
        const companyRole =
          typeof (parsed as { companyRole?: unknown }).companyRole === "string"
            ? String((parsed as { companyRole?: string }).companyRole)
            : null;
        const permissionRole =
          typeof (parsed as { permissionRole?: unknown }).permissionRole === "string"
            ? String((parsed as { permissionRole?: string }).permissionRole)
            : null;
        const [links, companies] = await Promise.all([
          listLocalLinksForUser(userId),
          listLocalCompanies(),
        ]);
        const allowed = isGlobalAdmin
          ? companies
          : companies.filter((company) => links.some((link) => link.companyId === company.id));
        return { userId, companySlugs: allowed.map((c) => c.slug), isGlobalAdmin, role, companyRole, permissionRole };
      } catch {
        return null;
      }
    }
    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload & { sub?: string; isGlobalAdmin?: boolean };
      const userId = typeof payload.sub === "string" ? payload.sub : null;
      if (!userId) return null;
      const isGlobalAdmin = payload.isGlobalAdmin === true;
      const role = typeof payload.role === "string" ? payload.role : null;
      const companyRole = typeof payload.companyRole === "string" ? payload.companyRole : null;
      const permissionRole = typeof payload.permissionRole === "string" ? payload.permissionRole : null;
      const [links, companies] = await Promise.all([
        listLocalLinksForUser(userId),
        listLocalCompanies(),
      ]);
      const allowed = isGlobalAdmin
        ? companies
        : companies.filter((company) => links.some((link) => link.companyId === company.id));
      return { userId, companySlugs: allowed.map((c) => c.slug), isGlobalAdmin, role, companyRole, permissionRole };
    } catch {
      // Token exists but is invalid/expired: do not fall back to session_id.
      return null;
    }
  }

  const sessionId = readCookieValue(cookieHeader, "session_id");
  if (!sessionId) return null;

  const redis = getRedis();
  const raw = await redis.get<string>(`session:${sessionId}`);
  if (!raw) return null;

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const userId = (parsed as { userId?: string; id?: string }).userId ?? (parsed as { id?: string }).id;
    if (!userId) return null;
    const isGlobalAdmin = (parsed as { isGlobalAdmin?: boolean }).isGlobalAdmin === true;
    const role = typeof (parsed as { role?: unknown }).role === "string" ? String((parsed as { role?: string }).role) : null;
    const companyRole =
      typeof (parsed as { companyRole?: unknown }).companyRole === "string"
        ? String((parsed as { companyRole?: string }).companyRole)
        : null;
    const permissionRole =
      typeof (parsed as { permissionRole?: unknown }).permissionRole === "string"
        ? String((parsed as { permissionRole?: string }).permissionRole)
        : null;
    const [links, companies] = await Promise.all([
      listLocalLinksForUser(userId),
      listLocalCompanies(),
    ]);
    const allowed = isGlobalAdmin
      ? companies
      : companies.filter((company) => links.some((link) => link.companyId === company.id));
    return { userId, companySlugs: allowed.map((c) => c.slug), isGlobalAdmin, role, companyRole, permissionRole };
  } catch {
    return null;
  }
}

function canAccessCompany(auth: AuthContext, companySlug: string) {
  return auth.companySlugs.includes(companySlug);
}

function canManageCompanyDocuments(auth: AuthContext) {
  const role = (auth.role ?? "").toLowerCase();
  const companyRole = (auth.companyRole ?? "").toLowerCase();
  const permissionRole = (auth.permissionRole ?? "").toLowerCase();
  const canManageByRole =
    role === "leader_tc" ||
    role === "technical_support" ||
    role === "company_user" ||
    companyRole === "leader_tc" ||
    companyRole === "technical_support" ||
    companyRole === "company_user" ||
    permissionRole === "leader_tc" ||
    permissionRole === "technical_support" ||
    permissionRole === "company_user";

  return auth.isGlobalAdmin || canManageByRole;
}

async function enrichItems(items: CompanyDocumentItem[]) {
  const users = await listLocalUsers();
  const namesByUserId = new Map(
    users.map((user) => [
      user.id,
      (typeof user.full_name === "string" && user.full_name.trim()) ||
        (typeof user.name === "string" && user.name.trim()) ||
        user.email,
    ]),
  );

  return items.map((item) => ({
    ...item,
    createdByName: item.createdBy ? namesByUserId.get(item.createdBy) ?? item.createdBy : null,
  }));
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado", items: [] }, { status: 401 });
  const canManage = canManageCompanyDocuments(auth);

  const url = new URL(req.url);
  const slugRaw = url.searchParams.get("slug") ?? "";
  const companySlug = sanitizeSlug(slugRaw);
  if (!companySlug) return NextResponse.json({ error: "slug obrigatório", items: [] }, { status: 400 });
  if (!canAccessCompany(auth, companySlug)) return NextResponse.json({ error: "Acesso negado", items: [] }, { status: 403 });

  const download = url.searchParams.get("download") === "1";
  const wantsHistory = url.searchParams.get("history") === "1";
  const downloadId = (url.searchParams.get("id") ?? "").trim();
  if (wantsHistory) {
    const history = await readHistory();
    const items = history.items
      .filter((event) => event.companySlug === companySlug)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return NextResponse.json({ history: items, canManage }, { status: 200 });
  }
  if (download) {
    if (!downloadId) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    const store = await readStore();
    const item = store.items.find((i) => i.companySlug === companySlug && i.id === downloadId) ?? null;
    if (!item) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    if (item.kind !== "file" || !item.storagePath) return NextResponse.json({ error: "Documento invalido" }, { status: 400 });

    const relative = item.storagePath.replace(/^local:/, "");
    const absolute = path.join(LOCAL_UPLOAD_ROOT, relative);
    try {
      const buf = await fs.readFile(absolute);
      const headers = new Headers();
      headers.set("content-type", item.mimeType || "application/octet-stream");
      if (item.fileName) {
        headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(item.fileName)}`);
      }
      return new NextResponse(buf, { status: 200, headers });
    } catch {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }
  }

  const store = await readStore();
  const items = await enrichItems(
    store.items
    .filter((i) => i.companySlug === companySlug)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((item) => {
      if (item.kind === "file") {
        const downloadUrl = `/api/company-documents?slug=${encodeURIComponent(companySlug)}&id=${encodeURIComponent(
          item.id
        )}&download=1`;
        return { ...item, url: downloadUrl };
      }
      return item;
    }),
  );

  return NextResponse.json({ items, canManage }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManageCompanyDocuments(auth)) return NextResponse.json({ error: "Sem permissão para gerenciar documentos" }, { status: 403 });

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const slugRaw = String(form.get("slug") ?? "");
    const companySlug = sanitizeSlug(slugRaw);
    const title = String(form.get("title") ?? "Documento").trim().slice(0, 120) || "Documento";
    const description = String(form.get("description") ?? "").trim().slice(0, 280) || null;
    const file = form.get("file");

    if (!companySlug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });
    if (!canAccessCompany(auth, companySlug)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    if (!(file instanceof File)) return NextResponse.json({ error: "arquivo obrigatório" }, { status: 400 });

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const fileName = sanitizeFilename(file.name || "documento");
    const folder = path.join(LOCAL_UPLOAD_ROOT, companySlug);
    await fs.mkdir(folder, { recursive: true });
    const filePath = path.join(folder, `${id}-${fileName}`);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    const storagePath = `local:${companySlug}/${id}-${fileName}`;

    const item: CompanyDocumentItem = {
      id,
      companySlug,
      kind: "file",
      title,
      description,
      fileName,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storagePath,
      createdAt,
      createdBy: auth.userId,
    };

    if (USE_POSTGRES) {
      await prisma.companyDocument.create({
        data: { ...item, createdAt: new Date(item.createdAt) },
      });
    } else {
      const store = await readStore();
      store.items.unshift(item);
      await writeStore(store);
    }
    await appendHistoryEvent("created", item, auth.userId);

    const downloadUrl = `/api/company-documents?slug=${encodeURIComponent(companySlug)}&id=${encodeURIComponent(
      item.id
    )}&download=1`;
    return NextResponse.json({ ok: true, item: { ...item, url: downloadUrl } }, { status: 200 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const record = (body ?? null) as Record<string, unknown> | null;
  const slugRaw = typeof record?.slug === "string" ? record.slug : "";
  const companySlug = sanitizeSlug(slugRaw);
  if (!companySlug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });
  if (!canAccessCompany(auth, companySlug)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const kind = (record?.kind === "file" ? "file" : "link") as CompanyDocumentKind;
  if (kind !== "link") return NextResponse.json({ error: "Use multipart/form-data para anexos" }, { status: 400 });

  const title = (typeof record?.title === "string" ? record.title : "Link").trim().slice(0, 120) || "Link";
  const description = (typeof record?.description === "string" ? record.description : "").trim().slice(0, 280) || null;
  const url = (typeof record?.url === "string" ? record.url : "").trim();
  if (!url) return NextResponse.json({ error: "url obrigatória" }, { status: 400 });

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const item: CompanyDocumentItem = {
    id,
    companySlug,
    kind: "link",
    title,
    description,
    url,
    createdAt,
    createdBy: auth.userId,
  };

  if (USE_POSTGRES) {
    await prisma.companyDocument.create({
      data: { ...item, createdAt: new Date(item.createdAt) },
    });
  } else {
    const store = await readStore();
    store.items.unshift(item);
    await writeStore(store);
  }
  await appendHistoryEvent("created", item, auth.userId);

  return NextResponse.json({ ok: true, item }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManageCompanyDocuments(auth)) return NextResponse.json({ error: "Sem permissão para gerenciar documentos" }, { status: 403 });

  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  const companySlug = sanitizeSlug(url.searchParams.get("slug") ?? "");
  if (!id || !companySlug) return NextResponse.json({ error: "id e slug obrigatorios" }, { status: 400 });
  if (!canAccessCompany(auth, companySlug)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  let removed: CompanyDocumentItem | undefined;
  if (USE_POSTGRES) {
    const row = await prisma.companyDocument.findFirst({ where: { id, companySlug } });
    if (!row) return NextResponse.json({ ok: true }, { status: 200 });
    removed = pgRowToDocItem(row);
    await prisma.companyDocument.delete({ where: { id } });
  } else {
    const store = await readStore();
    const idx = store.items.findIndex((i) => i.id === id && i.companySlug === companySlug);
    if (idx === -1) return NextResponse.json({ ok: true }, { status: 200 });
    [removed] = store.items.splice(idx, 1);
    await writeStore(store);
  }
  if (removed) {
    await appendHistoryEvent("deleted", removed, auth.userId);
  }

  if (removed?.kind === "file" && removed.storagePath?.startsWith("local:")) {
    try {
      const relative = removed.storagePath.slice("local:".length);
      const absolute = path.join(LOCAL_UPLOAD_ROOT, relative);
      await fs.unlink(absolute);
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!canManageCompanyDocuments(auth)) return NextResponse.json({ error: "Sem permissão para gerenciar documentos" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as unknown;
  const record = (body ?? null) as Record<string, unknown> | null;
  const slugRaw = typeof record?.slug === "string" ? record.slug : "";
  const companySlug = sanitizeSlug(slugRaw);
  const id = (typeof record?.id === "string" ? record.id : "").trim();
  if (!companySlug || !id) return NextResponse.json({ error: "slug e id obrigatórios" }, { status: 400 });
  if (!canAccessCompany(auth, companySlug)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const newTitle = typeof record?.title === "string" ? record.title.trim().slice(0, 120) : undefined;
  const newDescription = typeof record?.description === "string" ? record.description.trim().slice(0, 280) : undefined;
  const newUrl = typeof record?.url === "string" ? record.url.trim() : undefined;

  if (USE_POSTGRES) {
    const row = await prisma.companyDocument.findFirst({ where: { id, companySlug } });
    if (!row) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (newTitle !== undefined) data.title = newTitle || row.title;
    if (newDescription !== undefined) data.description = newDescription || null;
    if (newUrl !== undefined && row.kind === "link") data.url = newUrl || row.url;
    await prisma.companyDocument.update({ where: { id }, data });
  } else {
    const store = await readStore();
    const item = store.items.find((i) => i.id === id && i.companySlug === companySlug);
    if (!item) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    if (newTitle !== undefined) item.title = newTitle || item.title;
    if (newDescription !== undefined) item.description = newDescription || null;
    if (newUrl !== undefined && item.kind === "link") item.url = newUrl || item.url;
    await writeStore(store);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
