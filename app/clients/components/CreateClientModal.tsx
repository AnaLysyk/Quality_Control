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

export function CreateClientModal(props: Props) {
  const { open, onClose, onCreate, onOpenUser, clientId } = props;
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
    // Sanitize all input before validation
    const safeName = name.replace(/\s+/g, ' ').trim();
    const safeTaxId = taxId.replace(/\s+/g, '').trim();
    const safeZip = zip.replace(/\s+/g, '').trim();
    const safeAddress = address.replace(/\s+/g, ' ').trim();
    const safePhone = phone.replace(/\s+/g, ' ').trim();
    const safeWebsite = website.trim();
    const safeLogoUrl = logoUrl.trim();
    const safeLinkedin = linkedin.trim();
    const safeNotes = notes.trim();
    const safeDescription = description.trim();
    const safeQaseToken = qaseToken.trim();
    const safeQaseProjectCode = qaseProjectCode.trim();
    const safeQaseProjectCodesText = qaseProjectCodesText.trim();
    const safeJiraBaseUrl = jiraBaseUrl.trim();
    const safeJiraEmail = jiraEmail.trim();
    const safeJiraApiToken = jiraApiToken.trim();

    if (!safeName) {
      setError("Informe o nome da empresa.");
      return;
    }
    if (integrationMode === "qase") {
      const token = safeQaseToken;
      const project = safeQaseProjectCode;
      const projects = safeQaseProjectCodesText
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

    const jiraUrl = safeJiraBaseUrl;
    const jiraMail = safeJiraEmail;
    const jiraToken = safeJiraApiToken;
    const hasAnyJira = !!jiraUrl || !!jiraMail || !!jiraToken;
    if (hasAnyJira) {
      if (!jiraUrl) {
        setError("Informe a URL base do Jira (ex.: https://suaempresa.atlassian.net) ou limpe os campos do Jira.");
        return;
      }
      if (!/^https?:\/+/.test(jiraUrl)) {
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
      const projects = safeQaseProjectCodesText
        .split(/[\s,;|]+/g)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
      const uniqueProjects = projects.length ? Array.from(new Set(projects)) : undefined;

      const result = await onCreate({
        name: safeName,
        taxId: safeTaxId || undefined,
        zip: safeZip || undefined,
        address: safeAddress || undefined,
        phone: safePhone || undefined,
        website: safeWebsite || undefined,
        logoUrl: safeLogoUrl || undefined,
        linkedin: safeLinkedin || undefined,
        notes: safeNotes || undefined,
        description: safeDescription || undefined,
        active,
        integrationMode,
        qaseToken: integrationMode === "qase" ? safeQaseToken || undefined : undefined,
        qaseProjectCode:
          integrationMode === "qase" ? safeQaseProjectCode.toUpperCase() || undefined : undefined,
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Modal de cadastro de empresa"
      data-testid="create-client-modal"
    >
      <form
        aria-label="Cadastrar empresa"
        onSubmit={handleSubmit}
        className="w-full max-w-3xl rounded-xl border border-(--tc-border) bg-(--tc-surface) p-4 sm:p-6 shadow-2xl space-y-4 max-h-[calc(100vh-48px)] overflow-y-auto text-(--tc-text)"
        data-testid="create-client-form"
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
            disabled={busy}
            data-testid="close-modal-btn"
          >
            ×
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-(--tc-accent) bg-(--tc-accent-soft) px-3 py-2 text-sm text-(--tc-text)"
            data-testid="create-client-error"
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
              onChange={(e) => setName(e.target.value.replace(/\s+/g, ' '))}
              placeholder="Ex.: Testing Company LTDA"
              required
              disabled={busy}
              data-testid="client-name-input"
            />
          </label>
          <label className="block text-sm">
            CNPJ
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value.replace(/\s+/g, ''))}
              placeholder="00.000.000/0000-00"
              disabled={busy}
              data-testid="client-taxid-input"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            CEP
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\s+/g, ''))}
              placeholder="00000-000"
              disabled={busy}
              data-testid="client-zip-input"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            Endereco
            <input
              className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
              value={address}
              onChange={(e) => setAddress(e.target.value.replace(/\s+/g, ' '))}
              placeholder="Rua, numero, cidade"
              disabled={busy}
              data-testid="client-address-input"
            />
          </label>
          {/* Campos adicionais podem ser inseridos aqui, seguindo o mesmo padrão de sanitização e test-id */}
        </div>

        <fieldset className="mt-4 space-y-2" disabled={busy}>
          <legend className="sr-only">Integração</legend>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 rounded-md border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm">
              <input
                type="radio"
                name="integrationMode"
                value="manual"
                checked={integrationMode === "manual"}
                onChange={() => setIntegrationMode("manual")}
                disabled={busy}
                data-testid="integration-manual-radio"
              />
              <span>
                <span className="font-medium">Sem integração no momento</span>
                <span className="block text-xs text-(--tc-text-muted)">Cadastrar sem integrar agora</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-md border border-(--tc-border) bg-(--tc-surface) px-3 py-2 text-sm">
              <input
                type="radio"
                name="integrationMode"
                value="qase"
                checked={integrationMode === "qase"}
                onChange={() => setIntegrationMode("qase")}
                disabled={busy}
                data-testid="integration-qase-radio"
              />
              <span>
                <span className="font-medium">Integrar com Qase agora</span>
                <span className="block text-xs text-(--tc-text-muted)">Requer token + Project Code</span>
              </span>
            </label>
          </div>

          {integrationMode === "qase" && (
            <>
              <label className="block text-sm mt-2">
                Qase Project Codes (um por linha)
                <textarea
                  className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus) min-h-23"
                  value={qaseProjectCodesText}
                  onChange={(e) => setQaseProjectCodesText(e.target.value)}
                  placeholder={"ABC\nDEF\nGHI"}
                  disabled={busy}
                  data-testid="qase-project-codes-input"
                />
              </label>
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
                    disabled={busy}
                    data-testid="qase-token-input"
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
                    disabled={busy}
                    data-testid="qase-project-code-input"
                  />
                </label>
              </div>
            </>
          )}
        </fieldset>

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
                onChange={(e) => setJiraBaseUrl(e.target.value.trim())}
                placeholder="https://suaempresa.atlassian.net"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                data-testid="jira-baseurl-input"
              />
            </label>
            <label className="block text-sm">
              E-mail / usuário
              <input
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                value={jiraEmail}
                onChange={(e) => setJiraEmail(e.target.value.trim())}
                placeholder="usuario@empresa.com"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                data-testid="jira-email-input"
              />
            </label>
            <label className="block text-sm">
              API token
              <input
                className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                type="password"
                value={jiraApiToken}
                onChange={(e) => setJiraApiToken(e.target.value.trim())}
                placeholder="Token do Jira"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                data-testid="jira-token-input"
              />
            </label>
          </div>
        </div>

        <label className="block text-sm md:col-span-2 mt-4">
          Descricao curta
          <textarea
            className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Resumo da empresa"
            disabled={busy}
            data-testid="client-description-input"
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
            disabled={busy}
            data-testid="client-notes-input"
          />
        </label>
        <label className="flex items-center gap-2 text-sm mt-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={busy} data-testid="client-active-checkbox" />
          Status: {active ? "Ativo" : "Inativo"}
        </label>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 mt-4">
          <button
            type="button"
            className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm text-(--tc-text) hover:bg-(--tc-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            onClick={onClose}
            disabled={busy}
            data-testid="cancel-btn"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-(--tc-text-inverse,#ffffff) hover:bg-(--tc-accent-hover,#c80001) disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            disabled={busy}
            data-testid="submit-btn"
          >
            {busy ? 'Salvando...' : 'Salvar empresa'}
          </button>
        </div>
      </form>
    </div>
  );
}

