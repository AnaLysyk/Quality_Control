import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";

import { getRedis } from "@/lib/redis";
import { listLocalCompanies, listLocalLinksForUser } from "@/lib/auth/localStore";
import { getJwtSecret } from "@/lib/auth/jwtSecret";
import { getJsonStoreDir } from "@/data/jsonStorePath";

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
};

const STORE_PATH = path.join(getJsonStoreDir(), "company-documents-store.json");
const HISTORY_PATH = path.join(getJsonStoreDir(), "company-documents-history.json");
const LOCAL_UPLOAD_ROOT = path.join(getJsonStoreDir(), "company-documents-files");
const STORE_LOCK_PATH = `${STORE_PATH}.lock`;
const HISTORY_LOCK_PATH = `${HISTORY_PATH}.lock`;
const AUTHZ_CACHE_TTL_SECONDS = 60;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:"]);

function sanitizeSlug(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 80);
}

function sanitizeFilename(raw: string) {
  const trimmed = raw.trim().slice(0, 160);
  return trimmed.replace(/[\\/\0]/g, "_");
}

function safeJoin(root: string, target: string) {
  const rootAbs = path.resolve(root);
  const targetAbs = path.resolve(root, target);
  const relative = path.relative(rootAbs, targetAbs);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path traversal");
  }
  return targetAbs;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireLock(lockPath: string, retries = 25, delayMs = 20): Promise<FileHandle> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fs.open(lockPath, "wx");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "EEXIST" && attempt < retries) {
        await wait(delayMs);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Could not acquire lock at ${lockPath}`);
}

async function withFileLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const handle = await acquireLock(lockPath);
  try {
    return await fn();
  } finally {
    await handle.close();
    await fs.unlink(lockPath).catch(() => {});
  }
}

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify({ items: [] }, null, 2), "utf8");
  }
}

async function readStoreFromDisk(): Promise<{ items: CompanyDocumentItem[] }> {
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

async function writeStoreToDisk(next: { items: CompanyDocumentItem[] }) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(next, null, 2), "utf8");
}

async function readStore(): Promise<{ items: CompanyDocumentItem[] }> {
  return readStoreFromDisk();
}

async function mutateStore(mutator: (store: { items: CompanyDocumentItem[] }) => Promise<void> | void) {
  await withFileLock(STORE_LOCK_PATH, async () => {
    const store = await readStoreFromDisk();
    await mutator(store);
    await writeStoreToDisk(store);
  });
}

async function ensureHistoryStore() {
  await fs.mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  try {
    await fs.access(HISTORY_PATH);
  } catch {
    await fs.writeFile(HISTORY_PATH, JSON.stringify({ items: [] }, null, 2), "utf8");
  }
}

async function readHistoryFromDisk(): Promise<{ items: DocumentHistoryEvent[] }> {
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

async function writeHistoryToDisk(next: { items: DocumentHistoryEvent[] }) {
  await ensureHistoryStore();
  await fs.writeFile(HISTORY_PATH, JSON.stringify(next, null, 2), "utf8");
}

async function readHistory(): Promise<{ items: DocumentHistoryEvent[] }> {
  return readHistoryFromDisk();
}

async function mutateHistory(mutator: (history: { items: DocumentHistoryEvent[] }) => Promise<void> | void) {
  await withFileLock(HISTORY_LOCK_PATH, async () => {
    const history = await readHistoryFromDisk();
    await mutator(history);
    await writeHistoryToDisk(history);
  });
}

async function appendHistoryEvent(
  action: DocumentHistoryAction,
  item: CompanyDocumentItem,
  actorId?: string | null,
) {
  await mutateHistory((history) => {
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
  });
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

async function resolveAuthorizedCompanySlugs(userId: string, isGlobalAdmin: boolean): Promise<string[]> {
  const cacheKey = `authz:${userId}:${isGlobalAdmin ? "1" : "0"}`;
  const redis = getRedis();
  const cached = await redis.get<string>(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as string[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      /* ignore parse errors */
    }
  }

  const [links, companies] = await Promise.all([
    listLocalLinksForUser(userId),
    listLocalCompanies(),
  ]);
  const allowed = isGlobalAdmin
    ? companies
    : companies.filter((company) => links.some((link) => link.companyId === company.id));
  const slugs = allowed.map((company) => company.slug);
  await redis.set(cacheKey, JSON.stringify(slugs), { ex: AUTHZ_CACHE_TTL_SECONDS });
  return slugs;
}

async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  const cookieToken = readCookieValue(cookieHeader, "access_token") ?? readCookieValue(cookieHeader, "auth_token");
  const token = bearer || cookieToken;
  const redis = getRedis();
  if (token) {
    const secret = getJwtSecret();
    if (!secret) {
      const raw = await redis.get<string>(`session:${token}`);
      if (!raw) return null;
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const userId = (parsed as { userId?: string; id?: string }).userId ?? (parsed as { id?: string }).id;
        if (!userId) return null;
        const isGlobalAdmin = (parsed as { isGlobalAdmin?: boolean }).isGlobalAdmin === true;
        const companySlugs = await resolveAuthorizedCompanySlugs(userId, isGlobalAdmin);
        return { userId, companySlugs };
      } catch {
        return null;
      }
    }
    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload & { sub?: string; isGlobalAdmin?: boolean };
      const userId = typeof payload.sub === "string" ? payload.sub : null;
      if (!userId) return null;
      const isGlobalAdmin = payload.isGlobalAdmin === true;
      const companySlugs = await resolveAuthorizedCompanySlugs(userId, isGlobalAdmin);
      return { userId, companySlugs };
    } catch {
      // Token exists but is invalid/expired: do not fall back to session_id.
      return null;
    }
  }

  const sessionId = readCookieValue(cookieHeader, "session_id");
  if (!sessionId) return null;

  const raw = await redis.get<string>(`session:${sessionId}`);
  if (!raw) return null;

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const userId = (parsed as { userId?: string; id?: string }).userId ?? (parsed as { id?: string }).id;
    if (!userId) return null;
    const isGlobalAdmin = (parsed as { isGlobalAdmin?: boolean }).isGlobalAdmin === true;
    const companySlugs = await resolveAuthorizedCompanySlugs(userId, isGlobalAdmin);
    return { userId, companySlugs };
  } catch {
    return null;
  }
}

function canAccessCompany(auth: AuthContext, companySlug: string) {
  return auth.companySlugs.includes(companySlug);
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Nao autorizado", items: [] }, { status: 401 });

  const url = new URL(req.url);
  const slugRaw = url.searchParams.get("slug") ?? "";
  const companySlug = sanitizeSlug(slugRaw);
  if (!companySlug) return NextResponse.json({ error: "slug obrigatorio", items: [] }, { status: 400 });
  if (!canAccessCompany(auth, companySlug)) return NextResponse.json({ error: "Acesso negado", items: [] }, { status: 403 });

  const download = url.searchParams.get("download") === "1";
  const wantsHistory = url.searchParams.get("history") === "1";
  const downloadId = (url.searchParams.get("id") ?? "").trim();
  if (wantsHistory) {
    const history = await readHistory();
    const items = history.items
      .filter((event) => event.companySlug === companySlug)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return NextResponse.json({ history: items }, { status: 200 });
  }
  if (download) {
    if (!downloadId) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    const store = await readStore();
    const item = store.items.find((i) => i.companySlug === companySlug && i.id === downloadId) ?? null;
    if (!item) return NextResponse.json({ error: "Documento nao encontrado" }, { status: 404 });
    if (item.kind !== "file" || !item.storagePath) return NextResponse.json({ error: "Documento invalido" }, { status: 400 });

    const relative = item.storagePath.replace(/^local:/, "");
    let absolute: string;
    try {
      absolute = safeJoin(LOCAL_UPLOAD_ROOT, relative);
    } catch {
      return NextResponse.json({ error: "Documento invalido" }, { status: 400 });
    }
    try {
      const buf = await fs.readFile(absolute);
      const headers = new Headers();
      headers.set("content-type", item.mimeType || "application/octet-stream");
      if (item.fileName) {
        headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(item.fileName)}`);
      }
      return new NextResponse(buf, { status: 200, headers });
    } catch {
      return NextResponse.json({ error: "Arquivo nao encontrado" }, { status: 404 });
    }
  }

  const store = await readStore();
  const items = store.items
    .filter((i) => i.companySlug === companySlug)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((item) => {
      if (item.kind === "file") {
        const downloadUrl = `/api/company-documents?slug=${encodeURIComponent(companySlug)}&id=${encodeURIComponent(
          item.id,
        )}&download=1`;
        return { ...item, url: downloadUrl };
      }
      return item;
    });

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const slugRaw = String(form.get("slug") ?? "");
    const companySlug = sanitizeSlug(slugRaw);
    const title = String(form.get("title") ?? "Documento").trim().slice(0, 120) || "Documento";
    const description = String(form.get("description") ?? "").trim().slice(0, 280) || null;
    const file = form.get("file");

    if (!companySlug) return NextResponse.json({ error: "slug obrigatorio" }, { status: 400 });
    if (!canAccessCompany(auth, companySlug)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    if (!(file instanceof File)) return NextResponse.json({ error: "arquivo obrigatorio" }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande (max 10MB)" }, { status: 413 });
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const fileName = sanitizeFilename(file.name || "documento");
    const folder = safeJoin(LOCAL_UPLOAD_ROOT, companySlug);
    await fs.mkdir(folder, { recursive: true });
    const filePath = safeJoin(folder, `${id}-${fileName}`);
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

    await mutateStore((store) => {
      store.items.unshift(item);
    });
    await appendHistoryEvent("created", item, auth.userId);

    const downloadUrl = `/api/company-documents?slug=${encodeURIComponent(companySlug)}&id=${encodeURIComponent(
      item.id,
    )}&download=1`;
    return NextResponse.json({ ok: true, item: { ...item, url: downloadUrl } }, { status: 200 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const record = (body ?? null) as Record<string, unknown> | null;
  const slugRaw = typeof record?.slug === "string" ? record.slug : "";
  const companySlug = sanitizeSlug(slugRaw);
  if (!companySlug) return NextResponse.json({ error: "slug obrigatorio" }, { status: 400 });
  if (!canAccessCompany(auth, companySlug)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const kind = (record?.kind === "file" ? "file" : "link") as CompanyDocumentKind;
  if (kind !== "link") return NextResponse.json({ error: "Use multipart/form-data para anexos" }, { status: 400 });

  const title = (typeof record?.title === "string" ? record.title : "Link").trim().slice(0, 120) || "Link";
  const description = (typeof record?.description === "string" ? record.description : "").trim().slice(0, 280) || null;
  const url = (typeof record?.url === "string" ? record.url : "").trim();
  if (!url) return NextResponse.json({ error: "url obrigatoria" }, { status: 400 });
  let normalizedUrl: string;
  try {
    const parsedUrl = new URL(url);
    if (!ALLOWED_URL_PROTOCOLS.has(parsedUrl.protocol)) {
      return NextResponse.json({ error: "url invalida" }, { status: 400 });
    }
    normalizedUrl = parsedUrl.toString();
  } catch {
    return NextResponse.json({ error: "url invalida" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const item: CompanyDocumentItem = {
    id,
    companySlug,
    kind: "link",
    title,
    description,
    url: normalizedUrl,
    createdAt,
    createdBy: auth.userId,
  };

  await mutateStore((store) => {
    store.items.unshift(item);
  });
  await appendHistoryEvent("created", item, auth.userId);

  return NextResponse.json({ ok: true, item }, { status: 200 });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  const companySlug = sanitizeSlug(url.searchParams.get("slug") ?? "");
  if (!id || !companySlug) return NextResponse.json({ error: "id e slug obrigatorios" }, { status: 400 });
  if (!canAccessCompany(auth, companySlug)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  let removed: CompanyDocumentItem | undefined;
  await mutateStore((store) => {
    const idx = store.items.findIndex((i) => i.id === id && i.companySlug === companySlug);
    if (idx === -1) {
      return;
    }
    [removed] = store.items.splice(idx, 1);
  });
  if (!removed) return NextResponse.json({ ok: true }, { status: 200 });
  if (removed) {
    await appendHistoryEvent("deleted", removed, auth.userId);
  }

  if (removed?.kind === "file" && removed.storagePath?.startsWith("local:")) {
    try {
      const relative = removed.storagePath.slice("local:".length);
      const absolute = safeJoin(LOCAL_UPLOAD_ROOT, relative);
      await fs.unlink(absolute);
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
