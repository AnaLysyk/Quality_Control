import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getTicketsPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "tickets.json");
}

async function readTickets(companyId: string) {
  try {
    const data = await fs.readFile(getTicketsPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeTickets(companyId: string, tickets: any[]) {
  await fs.mkdir(path.dirname(getTicketsPath(companyId)), { recursive: true });
  await fs.writeFile(getTicketsPath(companyId), JSON.stringify(tickets, null, 2));
}

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const tickets = await readTickets(companyId);
  return NextResponse.json(tickets);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.title || !body.description || !body.createdBy) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const tickets = await readTickets(companyId);
  const newTicket = {
    id: crypto.randomUUID(),
    title: body.title,
    description: body.description,
    status: body.status || "backlog",
    priority: body.priority || "medium",
    type: body.type || "bug",
    attachments: body.attachments || [],
    createdBy: body.createdBy,
    companyId,
    createdAt: new Date().toISOString(),
    timeline: [{ status: "backlog", changedAt: new Date().toISOString() }],
  };
  tickets.push(newTicket);
  await writeTickets(companyId, tickets);
  return NextResponse.json(newTicket, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const tickets = await readTickets(companyId);
  const idx = tickets.findIndex((t: any) => t.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  Object.assign(tickets[idx], body.updates, { updatedAt: new Date().toISOString() });
  if (body.updates.status) {
    tickets[idx].timeline.push({ status: body.updates.status, changedAt: new Date().toISOString() });
  }
  await writeTickets(companyId, tickets);
  return NextResponse.json(tickets[idx]);
}

export async function DELETE(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const tickets = await readTickets(companyId);
  const idx = tickets.findIndex((t: any) => t.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  tickets[idx].deletedAt = new Date().toISOString();
  await writeTickets(companyId, tickets);
  return NextResponse.json({ ok: true });
}
