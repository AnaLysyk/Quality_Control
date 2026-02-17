import { NextResponse } from "next/server";

let apps: { id: string; nome: string; descricao: string }[] = [
  { id: "1", nome: "App Demo", descricao: "Aplicação de exemplo" },
];

export async function GET() {
  return NextResponse.json({ apps });
}

export async function POST(request: Request) {
  const data = await request.json();
  const id = Date.now().toString();
  const app = { id, nome: data.nome, descricao: data.descricao };
  apps.push(app);
  return NextResponse.json(app, { status: 201 });
}

export async function PUT(request: Request) {
  const data = await request.json();
  const idx = apps.findIndex((a) => a.id === data.id);
  if (idx === -1) return NextResponse.json({ error: "App não encontrado" }, { status: 404 });
  apps[idx] = { ...apps[idx], nome: data.nome, descricao: data.descricao };
  return NextResponse.json(apps[idx]);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  apps = apps.filter((a) => a.id !== id);
  return NextResponse.json({ ok: true });
}
