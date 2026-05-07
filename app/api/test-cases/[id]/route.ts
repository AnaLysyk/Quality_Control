import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { getTestCaseRecord } from "@/lib/test-cases/testCaseRepository";
import { filterTestCasesByPermission } from "@/lib/test-cases/testCasePermissions";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ message: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const record = await getTestCaseRecord(id);
  if (!record) return NextResponse.json({ message: "Caso não encontrado" }, { status: 404 });

  const [visibleRecord] = filterTestCasesByPermission([record], user);
  if (!visibleRecord) return NextResponse.json({ message: "Sem permissão" }, { status: 403 });

  return NextResponse.json(visibleRecord);
}
