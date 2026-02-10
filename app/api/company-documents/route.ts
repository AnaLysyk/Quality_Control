import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";

import { getRedis } from "@/lib/redis";
import { listLocalCompanies, listLocalLinksForUser } from "@/lib/auth/localStore";

type CompanyDocumentKind = "file" | "link";

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

type AuthContext = {
  userId: string;
  companySlugs: string[];
};

const STORE_PATH = path.join(process.cwd(), "data", "company-documents-store.json");
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "data", "company-documents-files");

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
  const cookieToken = readCookieValue(cookieHeader, "access_token");
  const token = bearer || cookieToken;
  const secret = process.env.JWT_SECRET;

  if (token) {
    if (!secret) {
      const redis = getRedis();
      const raw = await redis.get<string>(`session:${token}`);
      if (!raw) return null;
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        const userId = (parsed as { userId?: string; id?: string }).userId ?? (parsed as { id?: string }).id;
        if (!userId) return null;
        const isGlobalAdmin = (parsed as { isGlobalAdmin?: boolean }).isGlobalAdmin === true;
        const [links, companies] = await Promise.all([
          listLocalLinksForUser(userId),
          listLocalCompanies(),
        ]);
        const allowed = isGlobalAdmin
          ? companies
          : companies.filter((company) => links.some((link) => link.companyId === company.id));
        return { userId, companySlugs: allowed.map((c) => c.slug) };
      } catch {
        return null;
      }
    }

    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload & { sub?: string; isGlobalAdmin?: boolean };
      const userId = typeof payload.sub === "string" ? payload.sub : null;
      if (!userId) return null;
      const isGlobalAdmin = payload.isGlobalAdmin === true;
      const [links, companies] = await Promise.all([
        listLocalLinksForUser(userId),
        listLocalCompanies(),
      ]);
      const allowed = isGlobalAdmin
        ? companies
        : companies.filter((company) => links.some((link) => link.companyId === company.id));
      return { userId, companySlugs: allowed.map((c) => c.slug) };
    } catch {
      // Token exists but is invalid/expired: do not fall back to session_id.
      return null;
    }
  }

  if (!secret) {
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
      const [links, companies] = await Promise.all([
        listLocalLinksForUser(userId),
        listLocalCompanies(),
      ]);
      const allowed = isGlobalAdmin
        ? companies
        : companies.filter((company) => links.some((link) => link.companyId === company.id));
      return { userId, companySlugs: allowed.map((c) => c.slug) };
    } catch {
      return null;
    }
  }

  return null;
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
  const downloadId = (url.searchParams.get("id") ?? "").trim();
  if (download) {
    if (!downloadId) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
    const store = await readStore();
    const item = store.items.find((i) => i.companySlug === companySlug && i.id === downloadId) ?? null;
    if (!item) return NextResponse.json({ error: "Documento nao encontrado" }, { status: 404 });
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
          item.id
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

    const store = await readStore();
    store.items.unshift(item);
    await writeStore(store);

    const downloadUrl = `/api/company-documents?slug=${encodeURIComponent(companySlug)}&id=${encodeURIComponent(
      item.id
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

  const store = await readStore();
  store.items.unshift(item);
  await writeStore(store);

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

  const store = await readStore();
  const idx = store.items.findIndex((i) => i.id === id && i.companySlug === companySlug);
  if (idx === -1) return NextResponse.json({ ok: true }, { status: 200 });
  const [removed] = store.items.splice(idx, 1);
  await writeStore(store);

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
