import { prisma } from "@/lib/prisma";

type ClientEntry = {
  slug: string;
  name: string;
};

export async function listClients(): Promise<ClientEntry[]> {
  try {
    const companies = await prisma.company.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    });
    return companies.map((company) => ({ slug: company.slug, name: company.name }));
  } catch {
    return [];
  }
}
