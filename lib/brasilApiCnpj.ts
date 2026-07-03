export type BrasilApiCnpjLookup = {
  cnpj?: string | null;
  nome_fantasia?: string | null;
  razao_social?: string | null;
  company_name?: string | null;
  descricao_situacao_cadastral?: string | null;
  data_situacao_cadastral?: string | null;
  cnae_fiscal_descricao?: string | null;
  natureza_juridica?: string | null;
  capital_social?: string | null;
  porte?: string | null;
  opcao_pelo_simples?: boolean | null;
  data_opcao_pelo_simples?: string | null;
  abertura?: string | null;
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

/**
 * Valida CNPJ usando algoritmo de checksum
 * @param cnpj - CNPJ normalizado (14 dígitos) ou formatado
 * @returns true se CNPJ é válido, false caso contrário
 */
export function isCnpjValid(cnpj: string): boolean {
  const normalized = normalizeCnpj(cnpj);

  // Deve ter 14 dígitos
  if (normalized.length !== 14) return false;

  // Não pode ser todos os dígitos iguais (ex: 11111111111111)
  if (/^(\d)\1{13}$/.test(normalized)) return false;

  // Validar primeiro dígito verificador (usa os 12 primeiros dígitos)
  let sum = 0;
  let multiplier = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(normalized[i], 10) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }

  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(normalized[12], 10) !== digit1) return false;

  // Validar segundo dígito verificador (usa os 13 primeiros dígitos)
  sum = 0;
  multiplier = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(normalized[i], 10) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }

  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;

  return parseInt(normalized[13], 10) === digit2;
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

  const response = await fetch(`/api/public/company-lookup/cnpj?cnpj=${encodeURIComponent(normalized)}`, {
    signal,
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    item?: {
      companyName?: string;
      fantasyName?: string;
      cnpj?: string;
      cep?: string;
      address?: string;
      number?: string;
      complement?: string;
      district?: string;
      city?: string;
      state?: string;
      phone?: string;
      phone2?: string;
      email?: string;
      situation?: string;
      openingDate?: string;
      legalNature?: string;
      mainActivity?: string;
      size?: string;
      shareCapital?: string;
    };
    message?: string;
    error?: string;
  } | null;

  if (!response.ok || !payload?.item) {
    const message =
      typeof payload?.message === "string" && payload.message.trim()
        ? payload.message
        : typeof payload?.error === "string" && payload.error.trim()
          ? payload.error
          : "Não foi possível consultar o CNPJ.";
    throw new Error(message);
  }

  const item = payload.item;

  return {
    cnpj: item.cnpj || normalized,
    nome_fantasia: item.fantasyName || null,
    razao_social: item.companyName || null,
    company_name: item.companyName || item.fantasyName || null,
    descricao_situacao_cadastral: item.situation || null,
    data_situacao_cadastral: null,
    cnae_fiscal_descricao: item.mainActivity || null,
    natureza_juridica: item.legalNature || null,
    capital_social: item.shareCapital || null,
    porte: item.size || null,
    opcao_pelo_simples: null,
    data_opcao_pelo_simples: null,
    abertura: item.openingDate || null,
    cep: item.cep || null,
    logradouro: item.address || null,
    numero: item.number || null,
    complemento: item.complement || null,
    bairro: item.district || null,
    municipio: item.city || null,
    uf: item.state || null,
    ddd_telefone_1: item.phone || null,
    ddd_telefone_2: item.phone2 || null,
    email: item.email || null,
  } satisfies BrasilApiCnpjLookup;
}
