import { NextResponse } from "next/server";

function normalizeSupabaseUrl(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  let url = raw.replace(/\.supabase\.com\b/i, ".supabase.co");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  return url;
}

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = payload as { token?: unknown; new_password?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const newPassword = typeof body.new_password === "string" ? body.new_password : "";

  if (!token || !newPassword) {
    return NextResponse.json({ error: "token and new_password are required" }, { status: 400 });
  }

  const explicitUrl = (process.env.RESET_VIA_TOKEN_FN_URL ?? "").trim();
  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const fallbackUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/reset-via-token` : null;
  const functionUrl = explicitUrl || fallbackUrl;

  if (!functionUrl) {
    return NextResponse.json(
      {
        error: "Reset function URL not configured",
        details: "Set RESET_VIA_TOKEN_FN_URL or NEXT_PUBLIC_SUPABASE_URL",
      },
      { status: 500 }
    );
  }

  const upstream = await fetch(functionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "application/json";

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
