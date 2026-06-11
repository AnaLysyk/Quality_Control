from pathlib import Path

path = Path("lib/company-lookup/companyLookup.ts")
content = path.read_text(encoding="utf-8")

content = content.replace(
'''  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    throw new Error(data?.message ?? "Não foi possível consultar os dados da empresa.");
  }''',
'''  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
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
  }'''
)

path.write_text(content, encoding="utf-8")
