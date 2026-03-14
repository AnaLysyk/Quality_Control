import { NextResponse } from "next/server";

import { getAccessContext } from "@/lib/auth/session";
import { listLocalUsers } from "@/lib/auth/localStore";

function normalizeUsername(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");

  return normalized || "usuario";
}

export async function POST(req: Request) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        seed?: unknown;
        avoid?: unknown;
      }
    | null;

  const seed = typeof body?.seed === "string" ? body.seed.trim() : "";
  if (!seed) {
    return NextResponse.json({ error: "Seed obrigatoria" }, { status: 400 });
  }

  const avoid = new Set(
    Array.isArray(body?.avoid)
      ? body.avoid
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value) => value.trim().toLowerCase())
      : [],
  );

  const base = normalizeUsername(seed);
  const users = await listLocalUsers();
  const taken = new Set(
    users
      .filter((user) => user.id !== access.userId)
      .map((user) => (user.user ?? user.email ?? "").trim().toLowerCase())
      .filter(Boolean),
  );

  if (!taken.has(base) && !avoid.has(base)) {
    return NextResponse.json({ ok: true, username: base }, { status: 200 });
  }

  for (let counter = 2; counter < 10000; counter += 1) {
    const candidate = `${base}.${counter}`;
    if (!taken.has(candidate) && !avoid.has(candidate)) {
      return NextResponse.json({ ok: true, username: candidate }, { status: 200 });
    }
  }

  return NextResponse.json({ error: "Nao foi possivel gerar um login unico" }, { status: 500 });
}
