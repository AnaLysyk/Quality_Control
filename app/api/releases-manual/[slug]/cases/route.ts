import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { TestCaseCard } from "@/types/release";

const STORE_PATH = path.join(process.cwd(), "data", "releases-manual-cases.json");

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

function toArray(body: unknown): TestCaseCard[] {
  if (Array.isArray(body)) return body as TestCaseCard[];
  if (body && typeof body === "object" && "cards" in (body as Record<string, unknown>)) {
    return (body as { cards: TestCaseCard[] }).cards;
  }
  return body ? [body as TestCaseCard] : [];
}

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const store = await readStore();
  return NextResponse.json(store[params.slug] ?? []);
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const incoming = toArray(body).map((card) => ({
      ...card,
      fromApi: Boolean(card.fromApi),
    }));
    const store = await readStore();
    store[params.slug] = [...(store[params.slug] ?? []), ...incoming];
    await writeStore(store);
    return NextResponse.json(store[params.slug], { status: 201 });
  } catch (error) {
    console.error("POST /releases-manual/[slug]/cases error", error);
    return NextResponse.json({ message: "Erro ao salvar casos" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const incoming = toArray(body).map((card) => ({
      ...card,
      fromApi: Boolean(card.fromApi),
    }));
    const store = await readStore();
    const current = store[params.slug] ?? [];

    incoming.forEach((card) => {
      const idx = current.findIndex((c) => c.id === card.id);
      if (idx >= 0) {
        current[idx] = { ...current[idx], ...card };
      }
    });

    store[params.slug] = current;
    await writeStore(store);
    return NextResponse.json(store[params.slug]);
  } catch (error) {
    console.error("PATCH /releases-manual/[slug]/cases error", error);
    return NextResponse.json({ message: "Erro ao atualizar casos" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json().catch(() => ({} as { id?: string }));
    const targetId = body.id as string | undefined;
    if (!targetId) {
      return NextResponse.json({ message: "id obrigatório" }, { status: 400 });
    }
    const store = await readStore();
    const current = store[params.slug] ?? [];
    store[params.slug] = current.filter((c) => c.id !== targetId);
    await writeStore(store);
    return NextResponse.json(store[params.slug]);
  } catch (error) {
    console.error("DELETE /releases-manual/[slug]/cases error", error);
    return NextResponse.json({ message: "Erro ao remover caso" }, { status: 500 });
  }
}
