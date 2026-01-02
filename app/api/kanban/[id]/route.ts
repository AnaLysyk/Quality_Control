import { NextResponse } from "next/server";
import cards from "../store";
import type { Status } from "../types";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: "Id invalido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "JSON invalido" }, { status: 400 });

  const card = cards.find((c) => c.id === id);
  if (!card) return NextResponse.json({ message: "Card nao encontrado" }, { status: 404 });

  if (body.status) {
    const nextStatus = String(body.status).toUpperCase();
    if (!["PASS", "FAIL", "BLOCKED", "NOT_RUN"].includes(nextStatus)) {
      return NextResponse.json({ message: "Status invalido" }, { status: 400 });
    }
    card.status = nextStatus as Status;
  }
  if (body.title !== undefined) card.title = body.title?.trim();
  if (body.bug !== undefined) card.bug = body.bug ?? null;
  if (body.link !== undefined) card.link = body.link ?? null;

  return NextResponse.json(card);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: "Id invalido" }, { status: 400 });
  }

  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return NextResponse.json({ message: "Card nao encontrado" }, { status: 404 });
  const [removed] = cards.splice(idx, 1);
  return NextResponse.json({ id: removed.id });
}
