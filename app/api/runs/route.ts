import { NextResponse } from "next/server";

let runs: { id: string; nome: string; planoId: string }[] = [
  { id: "1", nome: "Run Demo", planoId: "1" },
];

export async function GET() {
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const data = await request.json();
  const id = Date.now().toString();
  const run = { id, nome: data.nome, planoId: data.planoId };
  runs.push(run);
  return NextResponse.json(run, { status: 201 });
}

export async function PUT(request: Request) {
  const data = await request.json();
  const idx = runs.findIndex((r) => r.id === data.id);
  if (idx === -1) return NextResponse.json({ error: "Run não encontrada" }, { status: 404 });
  runs[idx] = { ...runs[idx], nome: data.nome, planoId: data.planoId };
  return NextResponse.json(runs[idx]);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  runs = runs.filter((r) => r.id !== id);
  return NextResponse.json({ ok: true });
}
