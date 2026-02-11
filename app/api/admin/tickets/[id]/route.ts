import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTicketById, updateTicketStatus } from "@/lib/ticketsStore";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  if (!user.isGlobalAdmin) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const { id } = await context.params;
  const item = await getTicketById(id);
  if (!item) {
    return NextResponse.json({ error: "Chamado nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({ item }, { status: 200 });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }
  if (!user.isGlobalAdmin) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  const updated = await updateTicketStatus(id, nextStatus, user.id);
  if (!updated) {
    return NextResponse.json({ error: "Chamado nao encontrado ou status invalido" }, { status: 404 });
  }

  return NextResponse.json({ item: updated }, { status: 200 });
}
