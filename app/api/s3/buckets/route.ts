import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    source: "mock",
    buckets: [
      {
        name: "local-bucket",
        region: "local",
      },
    ],
  });
}
