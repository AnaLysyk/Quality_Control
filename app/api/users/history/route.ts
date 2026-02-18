
import { NextResponse } from "next/server";
import { readHistory } from "../repository";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url!);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });
  const history = await readHistory(companyId);
  return NextResponse.json(history);
}
