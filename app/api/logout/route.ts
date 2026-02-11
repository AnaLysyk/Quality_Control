import { NextResponse } from "next/server";
import { shouldUseSecureCookies } from "@/lib/auth/cookies";

export async function POST(req: Request) {
  const response = NextResponse.json({ ok: true });

  response.cookies.set("auth", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookies(req),
  });

  return response;
}
