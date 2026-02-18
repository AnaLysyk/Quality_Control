import { NextResponse } from "next/server";
import { readHistory } from "../../users/repository";

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  if (!companyId) return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });
  const { searchParams } = new URL(req.url!);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const history = await readHistory(companyId);
  const paginated = history.slice(offset, offset + limit);
  return NextResponse.json({ total: history.length, events: paginated });
}
