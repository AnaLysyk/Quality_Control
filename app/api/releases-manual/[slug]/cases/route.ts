import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { authenticateRequest } from "@/lib/jwtAuth";
import { canDeleteManualDefect, canEditManualDefect, getMockRole, resolveDefectRole } from "@/lib/rbac/defects";
import type { TestCaseCard } from "@/types/release";

const STORE_PATH = path.join(process.cwd(), "data", "releases-manual-cases.json");
const RELEASES_STORE_PATH = path.join(process.cwd(), "data", "releases-manual.json");

async function ensureStore() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, "{}", "utf8");
  }
}

async function readStore(): Promise<Record<string, TestCaseCard[]>> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, TestCaseCard[]>) : {};
  } catch {
    return {};
  }
}

async function writeStore(data: Record<string, TestCaseCard[]>) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function getReleaseClientSlug(slug: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(RELEASES_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const match = parsed.find((item) => item?.slug === slug);
    return typeof match?.clientSlug === "string" ? match.clientSlug : null;
  } catch {
    return null;
  }
}

function toArray(body: unknown): TestCaseCard[] {
  if (Array.isArray(body)) return body as TestCaseCard[];
  if (body && typeof body === "object" && "cards" in (body as Record<string, unknown>)) {
    return (body as { cards: TestCaseCard[] }).cards;
  }
  return body ? [body as TestCaseCard] : [];
}

function normalizeStatus(value: unknown): TestCaseCard["status"] {
  if (typeof value !== "string") return "NOT_RUN";
  const raw = value.trim();
  if (!raw) return "NOT_RUN";
  const upper = raw.toUpperCase();
  if (upper === "PASS" || upper === "PASSED") return "PASS";
  if (upper === "FAIL" || upper === "FAILED") return "FAIL";
  if (upper === "BLOCKED") return "BLOCKED";
  if (upper === "NOTRUN" || upper === "NOT_RUN" || upper === "NOT RUN" || upper === "UNTESTED") return "NOT_RUN";

  const lower = raw.toLowerCase();
  if (lower === "pass") return "PASS";
  if (lower === "fail") return "FAIL";
  if (lower === "blocked") return "BLOCKED";
  if (lower === "notrun" || lower === "not_run" || lower === "not run" || lower === "notRun".toLowerCase()) return "NOT_RUN";
  return "NOT_RUN";
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await readStore();
  return NextResponse.json(store[slug] ?? []);
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  try {
    const { slug } = await params;
    const clientSlug = await getReleaseClientSlug(slug);
    const role = await resolveDefectRole(effectiveAuthUser, clientSlug);
    if (!canEditManualDefect(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const incoming = toArray(body)
      .map((card) => ({
        ...card,
        fromApi: Boolean(card.fromApi),
        status: normalizeStatus((card as unknown as Record<string, unknown>).status),
      }))
      .filter((card) => Boolean(card.id) && Boolean(card.title));
    const store = await readStore();
    store[slug] = [...(store[slug] ?? []), ...incoming];
    await writeStore(store);
    return NextResponse.json(store[slug], { status: 201 });
  } catch (error) {
    console.error("POST /releases-manual/[slug]/cases error", error);
    return NextResponse.json({ message: "Erro ao salvar casos" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const authUser = await authenticateRequest(req);
  const mockRole = await getMockRole();
  const effectiveAuthUser =
    authUser ?? (mockRole ? { id: "mock-user", isGlobalAdmin: mockRole === "admin" } : null);
  if (!effectiveAuthUser) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });
  try {
    const { slug } = await params;
    const clientSlug = await getReleaseClientSlug(slug);
    const role = await resolveDefectRole(effectiveAuthUser, clientSlug);
    if (!canEditManualDefect(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const incoming = toArray(body)
      .map((card) => ({
        ...card,
        fromApi: Boolean(card.fromApi),
        status: normalizeStatus((card as unknown as Record<string, unknown>).status),
      }))
      .filter((card) => Boolean(card.id));
    const store = await readStore();
    const current = store[slug] ?? [];

    incoming.forEach((card) => {
      const idx = current.findIndex((c) => c.id === card.id);
      if (idx >= 0) {
        current[idx] = { ...current[idx], ...card };
      }
    });

    store[slug] = current;
    await writeStore(store);
    return NextResponse.json(store[slug]);
  } catch (error) {
    console.error("PATCH /releases-manual/[slug]/cases error", error);
    return NextResponse.json({ message: "Erro ao atualizar casos" }, { status: 500 });
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
    const clientSlug = await getReleaseClientSlug(slug);
    const role = await resolveDefectRole(effectiveAuthUser, clientSlug);
    if (!canDeleteManualDefect(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({} as { id?: string }));
    const targetId = body.id as string | undefined;
    if (!targetId) {
      return NextResponse.json({ message: "id obrigatório" }, { status: 400 });
    }
    const store = await readStore();
    const current = store[slug] ?? [];
    store[slug] = current.filter((c) => c.id !== targetId);
    await writeStore(store);
    return NextResponse.json(store[slug]);
  } catch (error) {
    console.error("DELETE /releases-manual/[slug]/cases error", error);
    return NextResponse.json({ message: "Erro ao remover caso" }, { status: 500 });
  }
}
