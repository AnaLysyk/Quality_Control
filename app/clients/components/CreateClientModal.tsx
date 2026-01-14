"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

export type ClientIntegrationMode = "qase" | "manual";

export type ClientFormValues = {
  name: string;
  taxId?: string;
  zip?: string;
  address?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  linkedin?: string;
  notes?: string;
  description?: string;
  active: boolean;
  integrationMode: ClientIntegrationMode;
  qaseToken?: string;
  qaseProjectCode?: string;
  qaseProjectCodes?: string[];
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: ClientFormValues) => Promise<{ id: string } | null> | { id: string } | null | void;
  onOpenUser?: (clientId: string) => void;
  clientId?: string | null;
};

function readId(value: unknown): string | null {
  const record = (value ?? null) as Record<string, unknown> | null;
  return typeof record?.id === "string" ? record.id : null;
}

export function CreateClientModal({ open, onClose, onCreate, onOpenUser, clientId }: Props) {
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFileName, setLogoFileName] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [integrationMode, setIntegrationMode] = useState<ClientIntegrationMode>("manual");
  const [qaseToken, setQaseToken] = useState("");
  const [qaseProjectCode, setQaseProjectCode] = useState("");
  const [qaseProjectCodesText, setQaseProjectCodesText] = useState("");
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(clientId ?? null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }
    if (integrationMode === "qase") {
      const token = qaseToken.trim();
      const project = qaseProjectCode.trim();
      const projects = qaseProjectCodesText
        .trim()
        .split(/[\s,;|]+/g)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
      const uniqueProjects = projects.length ? Array.from(new Set(projects)) : [];
      if (!token) {
        setError("Informe o token da Qase ou selecione 'Sem integração no momento'.");
        return;
      }
      const hasAnyProject = !!project || uniqueProjects.length > 0;
      if (!hasAnyProject) {
        setError("Informe ao menos 1 Project Code da Qase (campo único ou lista)." );
        return;
      }
      const codesToValidate = uniqueProjects.length ? uniqueProjects : [project.toUpperCase()];
      const invalid = codesToValidate.find((code) => !/^[A-Za-z0-9_-]{2,32}$/.test(code));
      if (invalid) {
        setError("Project Code inválido. Use 2-32 caracteres: letras, números, '_' ou '-'.");
        return;
      }
    }

    const jiraUrl = jiraBaseUrl.trim();
    const jiraMail = jiraEmail.trim();
    const jiraToken = jiraApiToken.trim();
    const hasAnyJira = !!jiraUrl || !!jiraMail || !!jiraToken;
    if (hasAnyJira) {
      if (!jiraUrl) {
        setError("Informe a URL base do Jira (ex.: https://suaempresa.atlassian.net) ou limpe os campos do Jira.");
        return;
      }
      if (!/^https?:\/\//i.test(jiraUrl)) {
        setError("A URL do Jira deve começar com http:// ou https://");
        return;
      }
      if (!jiraMail) {
        setError("Informe o e-mail/usuário do Jira (necessário para o token funcionar)." );
        return;
      }
      if (!jiraToken) {
        setError("Informe o API token do Jira (ou limpe os campos do Jira)." );
        return;
      }
    }
    setBusy(true);
    try {
      const projects = qaseProjectCodesText
        .trim()
        .split(/[\s,;|]+/g)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
      const uniqueProjects = projects.length ? Array.from(new Set(projects)) : undefined;

      const result = await onCreate({
        name: name.trim(),
        taxId: taxId.trim() || undefined,
        zip: zip.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        notes: notes.trim() || undefined,
        description: description.trim() || undefined,
        active,
        integrationMode,
        qaseToken: integrationMode === "qase" ? qaseToken.trim() || undefined : undefined,
        qaseProjectCode:
          integrationMode === "qase" ? qaseProjectCode.trim().toUpperCase() || undefined : undefined,
        qaseProjectCodes: integrationMode === "qase" ? uniqueProjects : undefined,
        jiraBaseUrl: jiraUrl || undefined,
        jiraEmail: jiraMail || undefined,
        jiraApiToken: jiraToken || undefined,
      });
      if (result === null || result === undefined) return;
      const newId = readId(result) ?? createdClientId;
      setCreatedClientId(newId);
      setName("");
      setTaxId("");
      setZip("");
      setAddress("");
      setPhone("");
      setWebsite("");
      setLogoUrl("");
      setLogoFileName("");
      setLinkedin("");
      setNotes("");
      setDescription("");
      setActive(true);
      setIntegrationMode("manual");
      setQaseToken("");
      setQaseProjectCode("");
      setQaseProjectCodesText("");
      setJiraBaseUrl("");
      setJiraEmail("");
      setJiraApiToken("");
      onClose();
      toast.success("Empresa cadastrada");
      if (newId && onOpenUser) {
        onOpenUser(newId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar empresa";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-4 overflow-y-auto">
      <form
        aria-label="Cadastrar empresa"
        onSubmit={handleSubmit}
        className="w-full max-w-3xl rounded-xl border border-(--tc-border) bg-(--tc-surface) p-4 sm:p-6 shadow-2xl space-y-4 max-h-[calc(100vh-48px)] overflow-y-auto text-(--tc-text)"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-(--tc-accent)">Empresa</p>
            <h3 className="text-xl font-semibold text-(--tc-text)">Cadastrar empresa</h3>
            <p className="text-sm text-(--tc-text-muted)">Preencha os campos principais do cliente.</p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-(--tc-text-muted) hover:bg-(--tc-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-(--tc-accent) bg-(--tc-accent-soft) px-3 py-2 text-sm text-(--tc-text)"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
          <label className="block text-sm">
            Nome / razao social
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Testing Company LTDA"
              required
            />
          </label>
          <label className="block text-sm">
            CNPJ
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            CEP
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="00000-000"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            Endereco
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, numero, cidade"
            />
          </label>

          {integrationMode === "qase" && (
            <label className="block text-sm md:col-span-2">
              Qase Project Codes (um por linha)
              <textarea
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus) min-h-23"
                value={qaseProjectCodesText}
                onChange={(e) => setQaseProjectCodesText(e.target.value)}
                placeholder="Ex.: APP1\nAPP2\nAPP3"
              />
              <p className="mt-1 text-xs text-(--tc-text-muted)">Opcional: se preencher, a empresa terá múltiplas aplicações (ordem importa).</p>
            </label>
          )}
          <label className="block text-sm">
            Telefone
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </label>
          <label className="block text-sm">
            Website
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://exemplo.com"
            />
          </label>
          <label className="block text-sm">
            Logo URL
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://cdn.../logo.png"
            />
          </label>
          <label className="block text-sm">
            Upload de logo (placeholder)
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setLogoFileName(file?.name ?? "");
                // TODO: integrar com storage e definir URL
              }}
            />
            {logoFileName && <p className="mt-1 text-xs text-(--tc-text-muted)">Selecionado: {logoFileName}</p>}
          </label>
          <label className="block text-sm">
            LinkedIn da empresa
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://www.linkedin.com/company/..."
            />
          </label>

          <fieldset className="md:col-span-2 rounded-lg border border-(--tc-border) bg-(--tc-surface-2) p-3">
            <legend className="px-1 text-sm font-semibold text-(--tc-text)">Integração</legend>
            <p className="mt-1 text-xs text-(--tc-text-muted)">
              Se você selecionar Qase, informe token e Project Code. Se não houver integração, a empresa fica em modo manual.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-2 rounded-md border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="integrationMode"
                  value="manual"
                  checked={integrationMode === "manual"}
                  onChange={() => setIntegrationMode("manual")}
                />
                <span>
                  <span className="font-medium">Sem integração no momento</span>
                  <span className="block text-xs text-(--tc-text-muted)">Entrada manual de run/kanban</span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="integrationMode"
                  value="qase"
                  checked={integrationMode === "qase"}
                  onChange={() => setIntegrationMode("qase")}
                />
                <span>
                  <span className="font-medium">Integrar com Qase agora</span>
                  <span className="block text-xs text-(--tc-text-muted)">Requer token + Project Code</span>
                </span>
              </label>
            </div>

            {integrationMode === "qase" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Token da Qase
                  <input
                    className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                      type="password"
                    value={qaseToken}
                    onChange={(e) => setQaseToken(e.target.value)}
                    placeholder="Token: ..."
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="block text-sm">
                  Project Code
                  <input
                    className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                    value={qaseProjectCode}
                    onChange={(e) => setQaseProjectCode(e.target.value)}
                    placeholder="Ex.: ABC"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-(--tc-border) bg-(--tc-surface) p-3">
              <p className="text-sm font-semibold text-(--tc-text)">Jira (opcional)</p>
              <p className="mt-1 text-xs text-(--tc-text-muted)">
                Se quiser, já cadastre o acesso do Jira do cliente. Esses dados ficam disponíveis apenas para admins.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  URL base do Jira
                  <input
                    className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                    value={jiraBaseUrl}
                    onChange={(e) => setJiraBaseUrl(e.target.value)}
                    placeholder="https://suaempresa.atlassian.net"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="block text-sm">
                  E-mail / usuário
                  <input
                    className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                    value={jiraEmail}
                    onChange={(e) => setJiraEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="block text-sm">
                  API token
                  <input
                    className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                    type="password"
                    value={jiraApiToken}
                    onChange={(e) => setJiraApiToken(e.target.value)}
                    placeholder="Token do Jira"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              </div>
            </div>
          </fieldset>

          <label className="block text-sm md:col-span-2">
            Descricao curta
            <textarea
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Resumo da empresa"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            Notas internas
            <textarea
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observacoes adicionais"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Status: {active ? "Ativo" : "Inativo"}
          </label>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <button
            type="button"
            className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm text-(--tc-text) hover:bg-(--tc-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-(--tc-text-inverse,#ffffff) hover:bg-(--tc-accent-hover,#c80001) disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            disabled={busy}
          >
            Salvar empresa
          </button>
        </div>
      </form>
    </div>
  );
}
