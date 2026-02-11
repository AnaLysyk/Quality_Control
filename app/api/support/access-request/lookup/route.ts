import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { listAccessRequests } from "@/data/accessRequestsStore";
import { listAccessRequestComments } from "@/data/accessRequestCommentsStore";
import { extractAdminNotes, parseAccessRequestMessage } from "@/lib/accessRequestMessage";

type SupportRequestRow = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: Date | string;
};

function normalizeLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCreatedAt(value: Date | string) {
  if (typeof value === "string") return value;
  return value.toISOString();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawName = url.searchParams.get("name") ?? "";
  const rawEmail = url.searchParams.get("email") ?? "";
  const name = normalizeLookup(rawName);
  const email = normalizeLookup(rawEmail);

  if (!name || !email) {
    return NextResponse.json({ error: "Informe nome e e-mail." }, { status: 400 });
  }

  let items: SupportRequestRow[] = [];
  if (shouldUseJsonStore()) {
    const list = await listAccessRequests();
    items = list.map((item) => ({
      id: item.id,
      email: item.email,
      message: item.message,
      status: item.status,
      created_at: item.created_at,
    }));
  } else {
    try {
      const list = await prisma.supportRequest.findMany({
        where: { email: rawEmail.trim().toLowerCase() },
        orderBy: { created_at: "desc" },
      });
      items = list.map((item) => ({
        id: item.id,
        email: item.email,
        message: item.message,
        status: item.status,
        created_at: item.created_at,
      }));
    } catch (error) {
      console.error("Erro ao consultar support_request, fallback JSON:", error);
      const list = await listAccessRequests();
      items = list.map((item) => ({
        id: item.id,
        email: item.email,
        message: item.message,
        status: item.status,
        created_at: item.created_at,
      }));
    }
  }

  const match = items.find((item) => {
    if (normalizeLookup(item.email ?? "") !== email) return false;
    const parsed = parseAccessRequestMessage(String(item.message ?? ""), String(item.email ?? ""));
    return normalizeLookup(parsed.name ?? "") === name;
  });

  if (!match) {
    return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 });
  }

  const parsed = parseAccessRequestMessage(String(match.message ?? ""), String(match.email ?? ""));
  const comments = await listAccessRequestComments(match.id);

  return NextResponse.json(
    {
      item: {
        id: match.id,
        status: match.status,
        createdAt: normalizeCreatedAt(match.created_at),
        email: parsed.email || match.email,
        name: parsed.name,
        jobRole: parsed.jobRole,
        company: parsed.company,
        clientId: parsed.clientId,
        accessType: parsed.accessType,
        notes: parsed.notes,
        adminNotes: extractAdminNotes(String(match.message ?? "")),
      },
      comments,
    },
    { status: 200 },
  );
}
