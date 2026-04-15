import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { importTickets } from "@/lib/ticketsStore";
import { isItDev } from "@/lib/rbac/tickets";

type ImportBody = {
  mode?: "merge" | "replace" | "upsert";
  data?: {
    format?: string;
    version?: number;
    exportedAt?: string;
    counter?: number;
    items?: Array<{
      id?: string;
      code?: string;
      title?: string;
      description?: string;
      status?: string;
      type?: string;
      priority?: string;
      tags?: string[];
      createdAt?: string;
      updatedAt?: string;
      createdBy?: string;
      createdByName?: string | null;
      createdByEmail?: string | null;
      companySlug?: string | null;
      companyId?: string | null;
      assignedToUserId?: string | null;
      updatedBy?: string | null;
      timeline?: Array<{ from: string; to: string; changedById: string; at: string }>;
    }>;
  };
};

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!isItDev(user)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as ImportBody;
  const mode = body.mode ?? "merge";
  const data = body.data;
  if (!data || !Array.isArray(data.items)) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const companyId = user.companyId ?? null;
  const companySlug = user.companySlug ?? null;
  const foreign = data.items.find((item) => {
    const sameCompany =
      (companyId && item.companyId === companyId) ||
      (companySlug && item.companySlug === companySlug);
    return !sameCompany;
  });
  if (foreign) {
    return NextResponse.json({ error: "Payload contem chamados de outra empresa" }, { status: 403 });
  }

  try {
    const result = await importTickets(data, mode);
    return NextResponse.json({ ok: true, items: result?.items?.length ?? 0 }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao importar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
