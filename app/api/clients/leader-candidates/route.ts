import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const { prisma } = await import("@/database/prismaClient");
  const users = await prisma.user.findMany({
    where: {
      active: true,
      OR: [
        { role: Role.leader_tc },
        { globalRole: "leader_tc" },
        { memberships: { some: { role: Role.leader_tc } } },
      ],
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, full_name: true, email: true },
    take: 200,
  });

  return NextResponse.json({
    items: users.map((user) => ({ id: user.id, name: user.full_name || user.name, email: user.email })),
  });
}
