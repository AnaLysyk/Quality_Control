import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "mockdb.json");

export async function GET() {
  try {
    const data = fs.readFileSync(DATA_PATH, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (err) {
    return NextResponse.json({ error: "Erro ao ler o banco JSON" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    fs.writeFileSync(DATA_PATH, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Erro ao salvar no banco JSON" }, { status: 500 });
  }
}
