import { NextResponse } from "next/server";
import { readHistory } from "../../users/repository";

function applyEvents(events: any[]) {
  const users: Record<string, any> = {};
  for (const e of events) {
    if (!e.user || !e.user.id) continue;
    const id = e.user.id;
    if (e.type === "USER_CREATED") {
      users[id] = { ...e.user };
    } else if (e.type === "USER_UPDATED" && users[id]) {
      users[id] = { ...users[id], ...e.user };
    } else if (e.type === "USER_DELETED" && users[id]) {
      users[id] = { ...users[id], deletedAt: e.user.deletedAt || e.timestamp };
    }
  }
  return Object.values(users);
}

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  if (!companyId) return NextResponse.json({ error: "companyId obrigatório" }, { status: 400 });
  const history = await readHistory(companyId);
  const state = applyEvents(history);
  return NextResponse.json(state);
}
