import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getLocalUserById } from "@/lib/auth/localStore";
import { createTicket, listTicketsForUser } from "@/lib/ticketsStore";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const items = await listTicketsForUser(user.id);
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const localUser = await getLocalUserById(user.id);
  const ticket = await createTicket({
    title: body?.title,
    description: body?.description,
    createdBy: user.id,
    createdByName: localUser?.name ?? null,
    createdByEmail: localUser?.email ?? null,
    companySlug: user.companySlug ?? null,
  });

  if (!ticket) {
    return NextResponse.json({ error: "Informe titulo ou descricao" }, { status: 400 });
  }

  return NextResponse.json({ item: ticket }, { status: 201 });
}
