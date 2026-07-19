export type CompanyLookupResult = {
  companyName: string;
  fantasyName: string;
  cnpj: string;
  cep: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  phone: string;
  phone2: string;
  email: string;
  situation: string;
  openingDate: string;
  legalNature: string;
  mainActivity: string;
  size: string;
  shareCapital: string;
};

export type CepLookupResult = {
  cep: string;
  address: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function money(value: unknown) {
  if (value === null || value === undefined || value === "") return "";

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export async function lookupCompanyByCnpj(cnpjInput: string): Promise<CompanyLookupResult> {
  const cnpj = onlyDigits(cnpjInput);

  if (cnpj.length !== 14) {
    throw new Error("Informe um CNPJ válido com 14 números.");
  }

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Quality-Control/1.0",
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const detail =
      data?.message ||
      data?.error ||
      `BrasilAPI retornou status ${response.status} para o CNPJ informado.`;

    throw new Error(detail);
  }

  return {
    companyName: text(data.razao_social),
    fantasyName: text(data.nome_fantasia),
    cnpj: text(data.cnpj) || cnpj,
    cep: text(data.cep),
    address: [text(data.descricao_tipo_de_logradouro), text(data.logradouro)].filter(Boolean).join(" ").trim(),
    number: text(data.numero),
    complement: text(data.complemento),
    district: text(data.bairro),
    city: text(data.municipio),
    state: text(data.uf),
    phone: text(data.ddd_telefone_1),
    phone2: text(data.ddd_telefone_2),
    email: text(data.email),
    situation: text(data.descricao_situacao_cadastral),
    openingDate: text(data.data_inicio_atividade),
    legalNature: text(data.natureza_juridica),
    mainActivity: text(data.cnae_fiscal_descricao),
    size: text(data.porte),
    shareCapital: money(data.capital_social),
  };
}

export async function lookupAddressByCep(cepInput: string): Promise<CepLookupResult> {
  const cep = onlyDigits(cepInput);

  if (cep.length !== 8) {
    throw new Error("Informe um CEP válido com 8 números.");
  }

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.erro === true) {
    throw new Error("CEP não encontrado.");
  }

  return {
    cep: text(data.cep) || cep,
    address: text(data.logradouro),
    complement: text(data.complemento),
    district: text(data.bairro),
    city: text(data.localidade),
    state: text(data.uf),
  };
}

