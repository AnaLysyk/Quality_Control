import { NextResponse } from "next/server";

let defects: { id: string; titulo: string; descricao: string; runId: string }[] = [
  { id: "1", titulo: "Defeito Demo", descricao: "Exemplo de defeito", runId: "1" },
];

export async function GET() {
  return NextResponse.json({ defects });
}

export async function POST(request: Request) {
  const data = await request.json();
  const id = Date.now().toString();
  const defect = { id, titulo: data.titulo, descricao: data.descricao, runId: data.runId };
  defects.push(defect);
  return NextResponse.json(defect, { status: 201 });
}

export async function PUT(request: Request) {
  const data = await request.json();
  const idx = defects.findIndex((d) => d.id === data.id);
  if (idx === -1) return NextResponse.json({ error: "Defeito não encontrado" }, { status: 404 });
  defects[idx] = { ...defects[idx], titulo: data.titulo, descricao: data.descricao, runId: data.runId };
  return NextResponse.json(defects[idx]);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  defects = defects.filter((d) => d.id !== id);
  return NextResponse.json({ ok: true });
}
