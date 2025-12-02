import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const baseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const project = searchParams.get("project");
  const runId = searchParams.get("runId");

  const url = new URL(`${SUPABASE_URL}/rest/v1/kanban_cases`);
  url.searchParams.set("select", "*");
  if (project) url.searchParams.set("project", `eq.${project}`);
  if (runId) url.searchParams.set("run_id", `eq.${runId}`);

  const res = await fetch(url.toString(), {
    headers: baseHeaders,
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/kanban_cases`, {
    method: "POST",
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/kanban_cases?id=eq.${id}`,
    {
      method: "DELETE",
      headers: baseHeaders,
    }
  );

  return NextResponse.json({ success: res.ok });

  
}
