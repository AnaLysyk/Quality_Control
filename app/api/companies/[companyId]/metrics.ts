import { NextResponse } from "next/server";
import { readUsers, readHistory } from "../../users/repository";

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  if (!companyId) return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });

  const users = await readUsers(companyId);
  const history = await readHistory(companyId);
  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const totalUsers = users.length;
  const totalDeleted = users.filter((u: any) => u.deletedAt).length;
  const totalCreatedLast7Days = history.filter((e: any) => e.type === "USER_CREATED" && new Date(e.timestamp) >= last7).length;
  const totalCreated = history.filter((e: any) => e.type === "USER_CREATED").length;
  const growthRate = totalCreated ? (totalCreatedLast7Days / totalCreated) : 0;

  return NextResponse.json({
    totalUsers,
    totalDeleted,
    totalCreatedLast7Days,
    growthRate
  });
}
