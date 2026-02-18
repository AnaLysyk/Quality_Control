import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getCommentsPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "defectComments.json");
}

async function readComments(companyId: string) {
  try {
    const data = await fs.readFile(getCommentsPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeComments(companyId: string, comments: any) {
  await fs.mkdir(path.dirname(getCommentsPath(companyId)), { recursive: true });
  await fs.writeFile(getCommentsPath(companyId), JSON.stringify(comments, null, 2));
}

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const { searchParams } = new URL(req.url!);
  const defectId = searchParams.get("defectId");
  const comments = await readComments(companyId);
  if (defectId) {
    return NextResponse.json(comments[defectId] || []);
  }
  return NextResponse.json(comments);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.defectId || !body.authorId || !body.body) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const comments = await readComments(companyId);
  if (!comments[body.defectId]) comments[body.defectId] = [];
  comments[body.defectId].push({
    id: crypto.randomUUID(),
    authorId: body.authorId,
    body: body.body,
    createdAt: new Date().toISOString(),
  });
  await writeComments(companyId, comments);
  return NextResponse.json({ ok: true });
}
