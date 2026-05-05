export type BrasilApiCnpjLookup = {
  cnpj?: string | null;
  nome_fantasia?: string | null;
  razao_social?: string | null;
  company_name?: string | null;
  error?: string | null;
  // Address
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  // Contact
  ddd_telefone_1?: string | null;
  ddd_telefone_2?: string | null;
  email?: string | null;
};

export function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "").slice(0, 14);
}

export function extractCnpjCompanyName(
  data?: Pick<BrasilApiCnpjLookup, "nome_fantasia" | "razao_social" | "company_name"> | null,
) {
  return data?.nome_fantasia?.trim() || data?.razao_social?.trim() || data?.company_name?.trim() || "";
}

export function extractCnpjAddress(data?: BrasilApiCnpjLookup | null): string {
  const parts = [data?.logradouro, data?.numero, data?.complemento, data?.bairro, data?.municipio, data?.uf].filter(
    (p) => typeof p === "string" && p.trim(),
  );
  return parts.join(", ");
}

export async function lookupCnpjCompany(cnpj: string, signal?: AbortSignal) {
  const normalized = normalizeCnpj(cnpj);
  if (normalized.length !== 14) return null;

  const response = await fetch(`/api/brasilapi/cnpj/${normalized}`, {
    signal,
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const data = (await response.json().catch(() => null)) as BrasilApiCnpjLookup | null;
  if (!response.ok) {
    const message = typeof data?.error === "string" && data.error.trim() ? data.error : "Nao foi possivel consultar a BrasilAPI";
    throw new Error(message);
  }

  return data;
}
