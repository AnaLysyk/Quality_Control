import "server-only";

import { prisma } from "@/lib/prismaClient";

export type ClienteSummary = {
  id: string;
  slug: string;
  name: string;
};

export async function getClienteBySlug(slug: string): Promise<ClienteSummary | null> {
  const normalized = (slug || "").trim();
  if (!normalized) return null;
  const company = await prisma.company.findUnique({
    where: { slug: normalized },
    select: { id: true, slug: true, name: true },
  });

  if (!company) return null;
  return { id: company.id, slug: company.slug, name: company.name };
}
