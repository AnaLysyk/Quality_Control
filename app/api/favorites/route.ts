import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";
import type { CreateFavoriteInput, FavoriteItem } from "@/backend/navigation/favoritesTypes";

export const runtime = "nodejs";
export const revalidate = 0;

// In-memory fallback store keyed by userId (used when DB model not yet migrated)
const memoryStore = new Map<string, FavoriteItem[]>();

function getUserFavorites(userId: string): FavoriteItem[] {
  return memoryStore.get(userId) ?? [];
}

function setUserFavorites(userId: string, items: FavoriteItem[]) {
  memoryStore.set(userId, items);
}

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const userId = String(user.id ?? user.email ?? "unknown");

  // Try Prisma first
  try {
    const { prisma } = await import("@/database/prismaClient");
    const rows = await (prisma as any).favorite.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
    });
    const favorites: FavoriteItem[] = rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      label: r.label,
      description: r.description ?? undefined,
      href: r.href,
      iconKey: r.iconKey ?? undefined,
      type: r.type as FavoriteItem["type"],
      context: r.context ? (r.context as FavoriteItem["context"]) : undefined,
      order: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
    return NextResponse.json({ favorites });
  } catch {
    // Fallback to memory store
    const favorites = getUserFavorites(userId);
    return NextResponse.json({ favorites });
  }
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const userId = String(user.id ?? user.email ?? "unknown");

  let body: CreateFavoriteInput;
  try {
    body = (await req.json()) as CreateFavoriteInput;
  } catch {
    return NextResponse.json({ message: "Corpo inválido" }, { status: 400 });
  }

  if (!body.label?.trim() || !body.href?.trim()) {
    return NextResponse.json({ message: "label e href são obrigatórios" }, { status: 400 });
  }

  // Try Prisma
  try {
    const { prisma } = await import("@/database/prismaClient");
    const existing = await (prisma as any).favorite.findFirst({ where: { userId, href: body.href } });
    if (existing) {
      const fav: FavoriteItem = {
        id: existing.id,
        userId,
        label: existing.label,
        href: existing.href,
        type: existing.type,
        context: existing.context ?? undefined,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
      return NextResponse.json({ favorite: fav });
    }

    const count = await (prisma as any).favorite.count({ where: { userId } });
    const row = await (prisma as any).favorite.create({
      data: {
        userId,
        label: body.label.trim(),
        description: body.description ?? null,
        href: body.href.trim(),
        iconKey: body.iconKey ?? null,
        type: body.type ?? "page",
        context: body.context ?? undefined,
        sortOrder: count,
      },
    });
    const favorite: FavoriteItem = {
      id: row.id,
      userId,
      label: row.label,
      description: row.description ?? undefined,
      href: row.href,
      iconKey: row.iconKey ?? undefined,
      type: row.type,
      context: row.context ?? undefined,
      order: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
    return NextResponse.json({ favorite }, { status: 201 });
  } catch {
    // Fallback to memory store
    const current = getUserFavorites(userId);
    if (current.some((f) => f.href === body.href)) {
      const existing = current.find((f) => f.href === body.href)!;
      return NextResponse.json({ favorite: existing });
    }
    const newItem: FavoriteItem = {
      id: `mem_${Date.now()}`,
      userId,
      label: body.label.trim(),
      description: body.description,
      href: body.href.trim(),
      iconKey: body.iconKey,
      type: body.type ?? "page",
      context: body.context,
      order: current.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setUserFavorites(userId, [...current, newItem]);
    return NextResponse.json({ favorite: newItem }, { status: 201 });
  }
}


