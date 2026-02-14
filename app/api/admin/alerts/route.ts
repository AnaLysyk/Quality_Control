import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { readAlertsStore } from "@/lib/qualityAlert";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (!user.isGlobalAdmin) {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  try {
    const alerts = await readAlertsStore();
    const res = NextResponse.json({ alerts: alerts ?? [] }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("[alerts] Falha ao ler alertas", error);
    return NextResponse.json({ error: "Falha ao ler alertas" }, { status: 500 });
  }
}
