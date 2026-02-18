import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getChamadosPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "chamados.json");
}

async function readChamados(companyId: string) {
  try {
    const data = await fs.readFile(getChamadosPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeChamados(companyId: string, chamados: any[]) {
  await fs.mkdir(path.dirname(getChamadosPath(companyId)), { recursive: true });
  await fs.writeFile(getChamadosPath(companyId), JSON.stringify(chamados, null, 2));
}

function safeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // fallback simples
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const chamados = await readChamados(companyId);
  return NextResponse.json(chamados);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  try {
    const { companyId } = params;
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!body.titulo || !body.descricao || !body.criadoPor) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: titulo, descricao, criadoPor" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const chamados = await readChamados(companyId);
    const novoChamado = {
      id: safeUUID(),
      titulo: body.titulo,
      descricao: body.descricao,
      status: body.status || "backlog",
      prioridade: body.prioridade || "media",
      tipo: body.tipo || "bug",
      anexos: body.anexos || [],
      criadoPor: body.criadoPor,
      companyId,
      criadoEm: new Date().toISOString(),
      historico: [{ status: "backlog", alteradoEm: new Date().toISOString() }],
    };
    chamados.push(novoChamado);
    await writeChamados(companyId, chamados);
    return NextResponse.json(novoChamado, { status: 201 });
  } catch (err: any) {
    console.error('POST /chamados error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err), stack: err?.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const chamados = await readChamados(companyId);
  const idx = chamados.findIndex((c: any) => c.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  Object.assign(chamados[idx], body.updates, { atualizadoEm: new Date().toISOString() });
  await writeChamados(companyId, chamados);
  return NextResponse.json(chamados[idx]);
}

export async function DELETE(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const chamados = await readChamados(companyId);
  const idx = chamados.findIndex((c: any) => c.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
  chamados[idx].deletadoEm = new Date().toISOString();
  await writeChamados(companyId, chamados);
  return NextResponse.json({ ok: true });
}
