import { NextResponse } from "next/server";
import { authenticateRequest } from "@/backend/jwtAuth";

export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const userId = String(user.id ?? user.email ?? "unknown");

  try {
    const { prisma } = await import("@/database/prismaClient");
    const row = await (prisma as any).favorite.findFirst({ where: { id, userId } });
    if (!row) return NextResponse.json({ message: "Favorito não encontrado" }, { status: 404 });
    await (prisma as any).favorite.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Silently succeed if table doesn't exist yet
  }
}

