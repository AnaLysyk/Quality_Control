import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getRunPath(companyId: string, runId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "runs", `${runId}.json`);
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.runId || !body.columns) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const runPath = getRunPath(companyId, body.runId);
  let run;
  try {
    const data = await fs.readFile(runPath, "utf8");
    run = JSON.parse(data);
  } catch {
    return NextResponse.json({ error: "Run não encontrada" }, { status: 404 });
  }
  run.columns = body.columns;
  run.updatedAt = new Date().toISOString();
  await fs.writeFile(runPath, JSON.stringify(run, null, 2));
  return NextResponse.json(run);
}
