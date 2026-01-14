import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_MOCK = process.env.SUPABASE_MOCK === "true";

type CompanyDocumentKind = "file" | "link";

export type CompanyDocumentItem = {
  id: string;
  companySlug: string;
  kind: CompanyDocumentKind;
  title: string;
  description?: string | null;
  url?: string | null; // for link
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storagePath?: string | null;
  createdAt: string;
  createdBy?: string | null;
};

type AuthContext = {
  authUserId: string;
  isGlobalAdmin: boolean;
  clientSlug: string | null;
};

const STORE_PATH = path.join(process.cwd(), "data", "company-documents-store.json");
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "data", "company-documents-files");

function sanitizeSlug(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 80);
}

function sanitizeFilename(raw: string) {
  const trimmed = raw.trim().slice(0, 160);
  // keep dots for extensions; remove path separators
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

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7);
  }
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/auth_token=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return null;
}

async function getAuthContext(req: Request): Promise<AuthContext | null> {
  if (SUPABASE_MOCK) {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const roleCookie = (readCookieValue(cookieHeader, "mock_role") ?? "admin").trim().toLowerCase();
    const slugCookie = (readCookieValue(cookieHeader, "mock_client_slug") ?? "").trim();
    const isAdmin = roleCookie === "admin";
    return {
      authUserId: isAdmin ? "mock-admin" : "mock-user",
      isGlobalAdmin: isAdmin,
      clientSlug: isAdmin ? null : slugCookie || null,
    };
  }

  const token = extractToken(req);
  if (!token) return null;

  const supabaseAdminModule = require("@/lib/supabaseServer");
  const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) return null;

  const authUser = authData.user;
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, is_global_admin, client_id")
    .eq("auth_user_id", authUser.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const isGlobalAdmin = Boolean((userRow as any)?.is_global_admin);
  const clientId = typeof (userRow as any)?.client_id === "string" ? (userRow as any).client_id : null;

  let clientSlug: string | null = null;
  if (clientId) {
    const { data: clientRow } = await supabaseAdmin
      .from("cliente")
      .select("slug")
      .eq("id", clientId)
      .limit(1)
      .maybeSingle();
    clientSlug = clientRow?.slug ?? null;
  }

  return { authUserId: authUser.id, isGlobalAdmin, clientSlug };
}

function canAccessCompany(auth: AuthContext, companySlug: string) {
  if (auth.isGlobalAdmin) return true;
  return !!auth.clientSlug && auth.clientSlug === companySlug;
}

async function tryListFromDb(companySlug: string) {
  try {
    const supabaseAdminModule = require("@/lib/supabaseServer");
    const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
    const { data, error } = await supabaseAdmin
      .from("company_documents")
      .select("id, company_slug, kind, title, description, url, file_name, mime_type, size_bytes, storage_path, created_at, created_by")
      .eq("company_slug", companySlug)
      .order("created_at", { ascending: false });
    if (error) return null;
    const items = (Array.isArray(data) ? data : []).map((row: any) =>
      ({
        id: String(row.id),
        companySlug: String(row.company_slug),
        kind: (row.kind as CompanyDocumentKind) || "link",
        title: String(row.title || "Documento"),
        description: row.description ?? null,
        url: row.url ?? null,
        fileName: row.file_name ?? null,
        mimeType: row.mime_type ?? null,
        sizeBytes: typeof row.size_bytes === "number" ? row.size_bytes : null,
        storagePath: row.storage_path ?? null,
        createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
        createdBy: row.created_by ?? null,
      }) as CompanyDocumentItem
    );
    return items;
  } catch {
    return null;
  }
}

async function tryInsertDb(item: CompanyDocumentItem) {
  try {
    const supabaseAdminModule = require("@/lib/supabaseServer");
    const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
    const { error } = await supabaseAdmin.from("company_documents").insert({
      id: item.id,
      company_slug: item.companySlug,
      kind: item.kind,
      title: item.title,
      description: item.description ?? null,
      url: item.url ?? null,
      file_name: item.fileName ?? null,
      mime_type: item.mimeType ?? null,
      size_bytes: item.sizeBytes ?? null,
      storage_path: item.storagePath ?? null,
      created_at: item.createdAt,
      created_by: item.createdBy ?? null,
    });
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

async function tryDeleteDb(id: string, companySlug: string) {
  try {
    const supabaseAdminModule = require("@/lib/supabaseServer");
    const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
    const { data } = await supabaseAdmin
      .from("company_documents")
      .select("storage_path")
      .eq("id", id)
      .eq("company_slug", companySlug)
      .limit(1)
      .maybeSingle();
    const storagePath = (data as any)?.storage_path ?? null;

    const { error } = await supabaseAdmin.from("company_documents").delete().eq("id", id).eq("company_slug", companySlug);
    if (error) return { ok: false as const };
    return { ok: true as const, storagePath: typeof storagePath === "string" ? storagePath : null };
  } catch {
    return { ok: false as const };
  }
}

async function signStorageUrl(storagePath: string): Promise<string | null> {
  try {
    const supabaseAdminModule = require("@/lib/supabaseServer");
    const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
    const { data } = await supabaseAdmin.storage.from("company-documents").createSignedUrl(storagePath, 60 * 30);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

async function uploadToSupabaseStorage(companySlug: string, id: string, file: File) {
  const fileName = sanitizeFilename(file.name || "documento");
  const storagePath = `${companySlug}/${id}-${fileName}`;
  try {
    const supabaseAdminModule = require("@/lib/supabaseServer");
    const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabaseAdmin.storage
      .from("company-documents")
      .upload(storagePath, new Uint8Array(arrayBuffer), { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) return null;
    return { storagePath, fileName };
  } catch {
    return null;
  }
}

async function uploadToLocalPrivate(companySlug: string, id: string, file: File) {
  const fileName = sanitizeFilename(file.name || "documento");
  const folder = path.join(LOCAL_UPLOAD_ROOT, companySlug);
  await fs.mkdir(folder, { recursive: true });
  const filePath = path.join(folder, `${id}-${fileName}`);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
  const relative = `${companySlug}/${id}-${fileName}`;
  return { storagePath: `local:${relative}`, fileName };
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

    const fromDb = await tryListFromDb(companySlug);
    const item =
      fromDb?.find((i) => i.id === downloadId) ??
      (await readStore()).items.find((i) => i.companySlug === companySlug && i.id === downloadId) ??
      null;

    if (!item) return NextResponse.json({ error: "Documento nao encontrado" }, { status: 404 });
    if (item.kind !== "file") return NextResponse.json({ error: "Documento nao e arquivo" }, { status: 400 });
    if (!item.storagePath) return NextResponse.json({ error: "Arquivo sem storagePath" }, { status: 400 });

    if (item.storagePath.startsWith("local:")) {
      const relative = item.storagePath.slice("local:".length);
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

    const signed = await signStorageUrl(item.storagePath);
    if (!signed) return NextResponse.json({ error: "Falha ao gerar link" }, { status: 500 });
    return NextResponse.redirect(signed);
  }

  const fromDb = await tryListFromDb(companySlug);
  if (fromDb) {
    const items = await Promise.all(
      fromDb.map(async (item) => {
        if (item.kind === "file" && item.storagePath) {
          if (item.storagePath.startsWith("local:")) {
            const downloadUrl = `/api/company-documents?slug=${encodeURIComponent(companySlug)}&id=${encodeURIComponent(
              item.id
            )}&download=1`;
            return { ...item, url: downloadUrl };
          }
          const signed = await signStorageUrl(item.storagePath);
          return { ...item, url: signed ?? item.url ?? null };
        }
        return item;
      })
    );
    return NextResponse.json({ items }, { status: 200 });
  }

  const store = await readStore();
  const items = store.items
    .filter((i) => i.companySlug === companySlug)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const hydrated = items.map((item) => {
    if (item.kind === "file" && item.storagePath?.startsWith("local:")) {
      const downloadUrl = `/api/company-documents?slug=${encodeURIComponent(companySlug)}&id=${encodeURIComponent(
        item.id
      )}&download=1`;
      return { ...item, url: downloadUrl };
    }
    return item;
  });

  return NextResponse.json({ items: hydrated }, { status: 200 });
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

    const supabaseUpload = await uploadToSupabaseStorage(companySlug, id, file);
    let item: CompanyDocumentItem;
    if (supabaseUpload) {
      item = {
        id,
        companySlug,
        kind: "file",
        title,
        description,
        fileName: supabaseUpload.fileName,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storagePath: supabaseUpload.storagePath,
        createdAt,
        createdBy: auth.authUserId,
        url: null,
      };
    } else {
      const local = await uploadToLocalPrivate(companySlug, id, file);
      item = {
        id,
        companySlug,
        kind: "file",
        title,
        description,
        fileName: local.fileName,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storagePath: local.storagePath,
        createdAt,
        createdBy: auth.authUserId,
        url: null,
      };
    }

    const inserted = await tryInsertDb(item);
    if (!inserted) {
      const store = await readStore();
      store.items.unshift(item);
      await writeStore(store);
    }

    if (item.kind === "file" && item.storagePath) {
      const signed = await signStorageUrl(item.storagePath);
      return NextResponse.json({ ok: true, item: { ...item, url: signed ?? null } }, { status: 200 });
    }

    return NextResponse.json({ ok: true, item }, { status: 200 });
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
    createdBy: auth.authUserId,
  };

  const inserted = await tryInsertDb(item);
  if (!inserted) {
    const store = await readStore();
    store.items.unshift(item);
    await writeStore(store);
  }

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

  const deletedDb = await tryDeleteDb(id, companySlug);
  if (deletedDb.ok) {
    const storagePath = deletedDb.storagePath;
    if (storagePath) {
      try {
        if (storagePath.startsWith("local:")) {
          const relative = storagePath.slice("local:".length);
          const absolute = path.join(LOCAL_UPLOAD_ROOT, relative);
          await fs.unlink(absolute);
        } else {
          const supabaseAdminModule = require("@/lib/supabaseServer");
          const supabaseAdmin = supabaseAdminModule.getSupabaseServer();
          await supabaseAdmin.storage.from("company-documents").remove([storagePath]);
        }
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  }

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
