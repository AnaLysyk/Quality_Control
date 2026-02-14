
// Este módulo só deve ser importado em server components ou rotas de API Next.js
import "server-only";

// Cliente Prisma para acesso ao banco de dados
import { prisma } from "@/lib/prismaClient";


/**
 * Resumo dos dados de um cliente (empresa) para uso em contextos públicos ou restritos.
 */
export type ClienteSummary = {
  id: string;
  slug: string;
  name: string;
};


/**
 * Busca um cliente (empresa) pelo slug, retornando apenas dados essenciais.
 *
 * @param slug Slug único da empresa (case-insensitive, sem espaços).
 * @returns Resumo do cliente ou null se não encontrado.
 */
export async function getClienteBySlug(slug: string): Promise<ClienteSummary | null> {
  // Normaliza o slug recebido (remove espaços e força string)
  const normalized = (slug || "").trim();
  if (!normalized) return null;

  // Busca a empresa pelo slug, retornando apenas os campos essenciais
  const company = await prisma.company.findUnique({
    where: { slug: normalized },
    select: { id: true, slug: true, name: true },
  });

  // Retorna null se não encontrado
  if (!company) return null;

  // Retorna o resumo padronizado
  return { id: company.id, slug: company.slug, name: company.name };
}
