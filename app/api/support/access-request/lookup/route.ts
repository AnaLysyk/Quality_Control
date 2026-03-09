import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";
import { shouldUseJsonStore } from "@/lib/storeMode";
import { listAccessRequests } from "@/data/accessRequestsStore";
import { listAccessRequestComments } from "@/data/accessRequestCommentsStore";
import { extractAdminNotes, parseAccessRequestMessage } from "@/lib/accessRequestMessage";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SupportRequestRow = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: Date | string;
  updated_at?: Date | string | null;
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

function normalizeOptionalDate(value?: Date | string | null) {
  if (!value) return null;
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
    return NextResponse.json({ error: "Informe nome e e-mail." }, { status: 400, headers: NO_STORE_HEADERS });
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
      updated_at: item.updated_at ?? null,
    }));
  } else {
    try {
      const list = (await prisma.supportRequest.findMany({
        where: { email: rawEmail.trim().toLowerCase() },
        orderBy: { created_at: "desc" },
      })) as SupportRequestRow[];
      items = list.map((item: SupportRequestRow) => ({
        id: item.id,
        email: item.email,
        message: item.message,
        status: item.status,
        created_at: item.created_at,
        updated_at: (item as { updated_at?: Date | string | null }).updated_at ?? null,
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
        updated_at: item.updated_at ?? null,
      }));
    }
  }

  const match = items.find((item) => {
    if (normalizeLookup(item.email ?? "") !== email) return false;
    const parsed = parseAccessRequestMessage(String(item.message ?? ""), String(item.email ?? ""));
    return normalizeLookup(parsed.fullName || parsed.name || "") === name;
  });

  if (!match) {
    return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const parsed = parseAccessRequestMessage(String(match.message ?? ""), String(match.email ?? ""));
  const comments = await listAccessRequestComments(match.id);

  return NextResponse.json(
    {
      item: {
        id: match.id,
        status: match.status,
        createdAt: normalizeCreatedAt(match.created_at),
        updatedAt: normalizeOptionalDate(match.updated_at),
        email: parsed.email || match.email,
        name: parsed.fullName || parsed.name,
        fullName: parsed.fullName || parsed.name,
        username: parsed.username,
        phone: parsed.phone,
        jobRole: parsed.jobRole,
        company: parsed.company,
        clientId: parsed.clientId,
        accessType: parsed.accessType,
        profileType: parsed.profileType,
        title: parsed.title,
        description: parsed.description,
        notes: parsed.notes,
        companyProfile: parsed.companyProfile,
        adminNotes: extractAdminNotes(String(match.message ?? "")),
      },
      comments,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}
