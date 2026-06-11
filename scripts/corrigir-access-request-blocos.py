# -*- coding: utf-8 -*-
from pathlib import Path

access_path = Path("app/login/access-request/AccessRequestClient.tsx")
status_path = Path("app/login/access-request/status/page.tsx")

content = access_path.read_text(encoding="utf-8-sig")

# 1) Garante função de gerar usuario/login
if "function normalizeSuggestedUser" not in content:
    anchor = '''function textOrFallback(value: string | null | undefined, fallback = "Não informado") {
  return value && value.trim() ? value : fallback;
}'''
    replacement = '''function textOrFallback(value: string | null | undefined, fallback = "Não informado") {
  return value && value.trim() ? value : fallback;
}

function normalizeSuggestedUser(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\\.+|\\.+$/g, "")
    .replace(/\\.{2,}/g, ".")
    .slice(0, 40);
}'''
    if anchor not in content:
        raise SystemExit("ERRO: nao achei textOrFallback.")
    content = content.replace(anchor, replacement, 1)

# 2) Garante função dentro do componente
if "const generateRequestedUser" not in content:
    anchor = '''  const [isRequestOpen, setIsRequestOpen] = useState(false);'''
    replacement = '''  const [isRequestOpen, setIsRequestOpen] = useState(false);

  const generateRequestedUser = () => {
    const source =
      accessType === "empresa"
        ? companyDraft.companyName || fullName || email
        : fullName || companyDraft.companyName || email;

    const suggested = normalizeSuggestedUser(source);

    if (suggested) {
      setRequestedUser(suggested);
    }
  };'''
    if anchor not in content:
        raise SystemExit("ERRO: nao achei isRequestOpen.")
    content = content.replace(anchor, replacement, 1)

# 3) Corrige payload para enviar usuario/login quando preenchido
content = content.replace(
    '''          user: accessType === "technical_support" ? normalizedRequestedUser || undefined : undefined,''',
    '''          user: normalizedRequestedUser || undefined,''',
)

# 4) Recria bloco Empresa vinculada inteiro
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

start = content.find("{requestProfileTypeNeedsCompany(accessType) ? (")
end = content.find("{isCompanyAccessRequest ? (", start)

if start == -1 or end == -1:
    raise SystemExit("ERRO: nao localizei o bloco Empresa vinculada.")

content = content[:start] + company_block + content[end:]

# 5) Recria grid Nome + Usuario/login + E-mail + Telefone inteiro
name_marker = 'data-testid="request-access-name-input"'
name_idx = content.find(name_marker)

if name_idx == -1:
    raise SystemExit("ERRO: nao achei campo Nome completo.")

grid_start = content.rfind('<div className="grid gap-4 sm:grid-cols-2">', 0, name_idx)
phone_marker = 'placeholder="+55 11 99999-9999"'
phone_idx = content.find(phone_marker, name_idx)

if grid_start == -1 or phone_idx == -1:
    raise SystemExit("ERRO: nao localizei grid Nome/E-mail/Telefone.")

phone_label_end = content.find("</label>", phone_idx)
grid_end = content.find("</div>", phone_label_end)

if phone_label_end == -1 or grid_end == -1:
    raise SystemExit("ERRO: nao consegui fechar grid Nome/E-mail/Telefone.")

grid_end += len("</div>")

new_grid = '''                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Nome completo
                    <input
                      data-testid="request-access-name-input"
                      ref={requestNameRef}
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                      className={inputBase}
                      placeholder="Ana Souza"
                    />
                  </label>

                  <label className={labelClass}>
                    Usuário/login
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={requestedUser}
                        onChange={(event) => setRequestedUser(event.target.value)}
                        className={inputBase}
                        placeholder={
                          isCompanyAccessRequest
                            ? "Gerado pelo nome da empresa"
                            : "Gerado pelo nome do solicitante"
                        }
                      />
                      <button
                        type="button"
                        onClick={generateRequestedUser}
                        className="shrink-0 rounded-xl border border-[#011848]/15 bg-white px-4 py-3 text-sm font-semibold text-[#011848] transition hover:bg-[#011848]/5 focus:outline-none focus:ring-2 focus:ring-[#ef0001]/40"
                      >
                        Gerar
                      </button>
                    </div>
                    <p className="text-xs font-medium text-[#64748b]">
                      Se ficar vazio, o sistema gera automaticamente. Se preencher, será usado esse login, respeitando unicidade.
                    </p>
                  </label>

                  <label className={labelClass}>
                    E-mail profissional
                    <input
                      data-testid="request-access-email-input"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className={inputBase}
                      placeholder="voce@empresa.com"
                    />
                  </label>

                  <label className={labelClass}>
                    Telefone
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      required
                      className={inputBase}
                      placeholder="+55 11 99999-9999"
                    />
                  </label>
                </div>'''

content = content[:grid_start] + new_grid + content[grid_end:]

# 6) Remove sobras quebradas antigas
content = content.replace("                  ) : null}", "")
content = content.replace("Obrigatório para o perfil Suporte Técnico.", "")

access_path.write_text(content, encoding="utf-8")

# 7) Corrige import do CSS da tela de status
if status_path.exists():
    status = status_path.read_text(encoding="utf-8-sig")
    status = status.replace(
        'import styles from "../LoginClient.module.css";',
        'import styles from "../../LoginClient.module.css";'
    )
    status_path.write_text(status, encoding="utf-8")

print("OK - AccessRequestClient corrigido.")