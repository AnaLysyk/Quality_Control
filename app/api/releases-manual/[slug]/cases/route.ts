
import { NextResponse } from "next/server";
import { authenticateRequest, type AuthUser } from "@/lib/jwtAuth";
import { readManualReleaseCases, writeManualReleaseCases, type ManualCaseItem } from "@/lib/manualReleaseStore";
import { getReleaseBySlug } from "@/release/data";


const ALLOWED_STATUS = ["passed", "failed", "blocked", "not_run", "skipped"] as const;
type AllowedStatus = typeof ALLOWED_STATUS[number];

function normalizeItem(raw: Record<string, unknown>): ManualCaseItem | null {
  const id = raw.id ?? raw.caseId ?? raw.case_id;
  if (!id) return null;
  let status: AllowedStatus | undefined = undefined;
  if (typeof raw.status === "string" && ALLOWED_STATUS.includes(raw.status as AllowedStatus)) {
    status = raw.status as AllowedStatus;
  }
  return {
    id: String(id),
    title: typeof raw.title === "string" ? raw.title : undefined,
    link: typeof raw.link === "string" ? raw.link : undefined,
    status,
    bug: typeof raw.bug === "string" ? raw.bug : null,
    fromApi: Boolean(raw.fromApi ?? raw.from_api),
  };
}

async function ensureUserCanAccessSlug(user: AuthUser, slug: string) {
  if (user.isGlobalAdmin) return true;
  const release = await getReleaseBySlug(slug);
  if (!release) return false;
  // Prefer clientId/clientSlug do release, mas comparar com companyId/companySlug do usuário
  if (release.clientId && user.companyId && release.clientId === user.companyId) return true;
  if (release.clientSlug && user.companySlug && release.clientSlug === user.companySlug) return true;
  return false;
}

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
    const { slug } = await context.params;
    if (!(await ensureUserCanAccessSlug(user, slug))) {
      return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
    }
    const store = await readManualReleaseCases();
    const items = Array.isArray(store[slug]) ? store[slug] : [];
    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /cases error:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
    const { slug } = await context.params;
    if (!(await ensureUserCanAccessSlug(user, slug))) {
      return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as unknown;
    if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });
    const store = await readManualReleaseCases();
    const list = Array.isArray(store[slug]) ? store[slug] : [];
    const payload = Array.isArray(body) ? body : [body];
    payload.forEach((row) => {
      const item = normalizeItem((row ?? {}) as Record<string, unknown>);
      if (!item) return;
      // impede duplicação por id
      if (!list.some((existing) => String(existing.id) === item.id)) {
        list.push(item);
      }
    });
    store[slug] = list;
    await writeManualReleaseCases(store);
    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    console.error("POST /cases error:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
    const { slug } = await context.params;
    if (!(await ensureUserCanAccessSlug(user, slug))) {
      return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });
    const store = await readManualReleaseCases();
    const list = Array.isArray(store[slug]) ? store[slug] : [];
    const incoming = normalizeItem(body);
    if (!incoming) return NextResponse.json({ message: "Item invalido" }, { status: 400 });
    const index = list.findIndex((item) => String(item.id) === incoming.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...incoming };
    } else {
      list.push(incoming);
    }
    store[slug] = list;
    await writeManualReleaseCases(store);
    return NextResponse.json(incoming);
  } catch (error) {
    console.error("PATCH /cases error:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
    const { slug } = await context.params;
    if (!(await ensureUserCanAccessSlug(user, slug))) {
      return NextResponse.json({ message: "Acesso proibido" }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });
    const id = body.id ?? body.caseId ?? body.case_id;
    if (!id) return NextResponse.json({ message: "ID obrigatorio" }, { status: 400 });
    const store = await readManualReleaseCases();
    const list = Array.isArray(store[slug]) ? store[slug] : [];
    if (!list.length) return NextResponse.json({ message: "Slug inexistente" }, { status: 404 });
    store[slug] = list.filter((item) => String(item.id) !== String(id));
    await writeManualReleaseCases(store);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /cases error:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  }
}
