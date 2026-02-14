import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  // Audit log
  const ip_address = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const user_agent = req.headers.get("user-agent") || null;
  console.info("[HEALTH_GET]", {
    userId: user.id,
    email: user.email,
    ip_address,
    user_agent,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ status: "ok" });
}
