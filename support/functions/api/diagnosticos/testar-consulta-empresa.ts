async function main() {
  const { lookupCompanyByCnpj, lookupAddressByCep } = await import("@/lib/company-lookup/companyLookup");

  const cnpj = process.env.TEST_CNPJ ?? "19131243000197";
  const cep = process.env.TEST_CEP ?? "01001000";

  console.log("[CNPJ TEST] Consultando CNPJ:", cnpj);

  const empresa = await lookupCompanyByCnpj(cnpj);

  console.log("[CNPJ TEST] Resultado:");
  console.log(JSON.stringify(empresa, null, 2));

  if (!empresa.companyName) {
    throw new Error("CNPJ consultou, mas não retornou razão social.");
  }

  if (!empresa.cep) {
    console.warn("[CNPJ TEST] Atenção: CNPJ não retornou CEP.");
  }

  console.log("");
  console.log("[CEP TEST] Consultando CEP:", cep);

  const endereco = await lookupAddressByCep(cep);

  console.log("[CEP TEST] Resultado:");
  console.log(JSON.stringify(endereco, null, 2));

  if (!endereco.address || !endereco.city || !endereco.state) {
    throw new Error("CEP consultou, mas não retornou endereço completo.");
  }

  console.log("");
  console.log("[LOOKUP TEST] OK - CNPJ e CEP funcionando.");
}

main().catch((error) => {
  console.error("[LOOKUP TEST] ERRO:", error);
  process.exitCode = 1;
});

