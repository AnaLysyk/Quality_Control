# -*- coding: utf-8 -*-
from pathlib import Path

path = Path("app/login/access-request/AccessRequestClient.tsx")
content = path.read_text(encoding="utf-8-sig")

marker = "{isCompanyAccessRequest ? ("
marker_index = content.find(marker)

if marker_index == -1:
    raise SystemExit("ERRO: nao achei {isCompanyAccessRequest ? (")

# Pega o trecho imediatamente antes do bloco de empresa
before = content[:marker_index]
after = content[marker_index:]

# A sobra quebrada sempre termina imediatamente antes do marker
# e contem "Nenhuma empresa cadastrada disponível para selecionar."
broken_text = "Nenhuma empresa cadastrada disponível para selecionar."

broken_index = before.rfind(broken_text)

if broken_index == -1:
    print("AVISO: nao achei texto da sobra quebrada. Vou tentar remover sobra ') : null}' solta.")
    before = before.replace("                  ) : null}", "")
else:
    # Volta ate o inicio do label/bloco quebrado mais proximo
    label_start = before.rfind("<label", 0, broken_index)
    conditional_start = before.rfind("{requestProfileTypeNeedsCompany(accessType) ? (", 0, broken_index)

    if conditional_start != -1 and conditional_start > label_start:
        start = conditional_start
    elif label_start != -1:
        start = label_start
    else:
        raise SystemExit("ERRO: achei texto quebrado, mas nao consegui achar inicio do bloco.")

    before = before[:start]

company_block = '''                {requestProfileTypeNeedsCompany(accessType) ? (
                  <label className={labelClass}>
                    Empresa vinculada
                    <select
                      data-testid="request-access-company-input"
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                      required
                      className={inputBase}
                      disabled={companiesLoading || companyOptions.length === 0}
                    >
                      <option value="">
                        {companiesLoading ? "Carregando empresas..." : "Selecione uma empresa cadastrada"}
                      </option>
                      {companyOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    {companiesError ? (
                      <p className="text-xs font-medium text-rose-600">{companiesError}</p>
                    ) : companyOptions.length === 0 && !companiesLoading ? (
                      <p className="text-xs font-medium text-rose-600">
                        Nenhuma empresa cadastrada disponível para selecionar.
                      </p>
                    ) : null}
                  </label>
                ) : null}

'''

content = before + company_block + after

# Remove sobras exatas que ainda possam ter ficado
content = content.replace("                  ) : null}", "")

path.write_text(content, encoding="utf-8")

print("OK - bloco quebrado antes de isCompanyAccessRequest foi removido e recriado.")