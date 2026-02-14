import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { listAccessRequests } from "@/data/accessRequestsStore";
import { getAccessContextFromStores } from "@/lib/auth/session";
import { listLocalCompanies } from "@/lib/auth/localStore";
import { extractAdminNotes } from "@/lib/accessRequestMessage";
import { prisma } from "@/lib/prismaClient";
import { shouldUseJsonStore } from "@/lib/storeMode";

import { AccessRequestsClient } from "./AccessRequestsClient";
import {
  parseFromMessage,
  type AccessRequestItem,
  type AccessTypeLabel,
  type ClientOption,
  type RawSupportRequest,
} from "./shared";

type AdminRow = RawSupportRequest & { admin_notes?: string | null };
type SupportRequestRow = {
  id: string;
  email: string;
  message: string | null;
  status: string | null;
  created_at: Date;
};

function mapAccessRequest(raw: AdminRow): AccessRequestItem {
  const message = String(raw.message ?? "");
  const fallbackEmail = String(raw.email ?? "");
  const parsed = parseFromMessage(message, fallbackEmail);
  const accessType = (parsed.accessType as AccessTypeLabel) ?? "Usuario da empresa";
  const adminNotes = typeof raw.admin_notes === "string" ? raw.admin_notes : extractAdminNotes(message);

  return {
    id: String(raw.id),
    createdAt: String(raw.created_at),
    status: String(raw.status ?? "open"),
    email: String(parsed.email ?? fallbackEmail),
    name: String(parsed.name ?? ""),
    jobRole: String(parsed.jobRole ?? ""),
    accessType,
    clientId: parsed.clientId ?? null,
    company: String(parsed.company ?? ""),
    notes: String(parsed.notes ?? ""),
    rawMessage: message,
    adminNotes: adminNotes ?? null,
  } satisfies AccessRequestItem;
}

async function fetchAccessRequests(): Promise<AccessRequestItem[]> {
  if (shouldUseJsonStore()) {
    const items = await listAccessRequests();
    return items.map((item) =>
      mapAccessRequest({
        id: item.id,
        email: item.email,
        message: item.message,
        status: item.status,
        created_at: item.created_at,
        admin_notes: extractAdminNotes(item.message),
      }),
    );
  }

  try {
    const rows = await prisma.supportRequest.findMany({
      orderBy: { created_at: "desc" },
      take: 1000,
    });

    return rows.map((row: SupportRequestRow) =>
      mapAccessRequest({
        id: row.id,
        email: row.email,
        message: row.message ?? "",
        status: row.status ?? "open",
        created_at: row.created_at.toISOString(),
        admin_notes: extractAdminNotes(row.message ?? ""),
      }),
    );
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      console.error("[admin/access-requests] Falha ao consultar banco (sem fallback)", error);
      throw error;
    }

    console.warn("[admin/access-requests] Falha ao consultar banco, usando fallback JSON", error);
    const items = await listAccessRequests();
    return items.map((item) =>
      mapAccessRequest({
        id: item.id,
        email: item.email,
        message: item.message,
        status: item.status,
        created_at: item.created_at,
        admin_notes: extractAdminNotes(item.message),
      }),
    );
  }
}

async function fetchClientOptions(): Promise<ClientOption[]> {
  try {
    const companies = await listLocalCompanies();
    return companies
      .map((company) => ({
        id: String(company.id ?? ""),
        name: String(company.name ?? company.company_name ?? ""),
      }))
      .filter((company) => company.id && company.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("[admin/access-requests] Falha ao carregar empresas", error);
    return [];
  }
}

export const dynamic = "force-dynamic";

export default async function AdminAccessRequestsPage() {
  const cookieStore = await cookies();
  const access = await getAccessContextFromStores(undefined, cookieStore);

  if (!access) {
    redirect("/login");
  }

    if (!access.isGlobalAdmin) {
      const slug = access.companySlug;
      redirect(slug ? `/empresas/${encodeURIComponent(slug)}/home` : "/empresas");
  }

  const [requests, clients] = await Promise.all([fetchAccessRequests(), fetchClientOptions()]);

  return <AccessRequestsClient initialRequests={requests} initialClients={clients} />;
}
