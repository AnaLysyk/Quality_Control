import { NextResponse } from "next/server";

let testPlans: { id: string; nome: string; descricao: string }[] = [
  { id: "1", nome: "Plano Demo", descricao: "Plano de teste de exemplo" },
];

export async function GET() {
  return NextResponse.json({ testPlans });
}

export async function POST(request: Request) {
  const data = await request.json();
  const id = Date.now().toString();
  const plan = { id, nome: data.nome, descricao: data.descricao };
  testPlans.push(plan);
  return NextResponse.json(plan, { status: 201 });
}

export async function PUT(request: Request) {
  const data = await request.json();
  const idx = testPlans.findIndex((p) => p.id === data.id);
  if (idx === -1) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
  testPlans[idx] = { ...testPlans[idx], nome: data.nome, descricao: data.descricao };
  return NextResponse.json(testPlans[idx]);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  testPlans = testPlans.filter((p) => p.id !== id);
  return NextResponse.json({ ok: true });
}
