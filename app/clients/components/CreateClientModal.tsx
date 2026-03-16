"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
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

type QaseProjectOption = {
  code: string;
  title: string;
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

function uniqCodes(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean)));
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
  const [qaseProjects, setQaseProjects] = useState<QaseProjectOption[]>([]);
  const [selectedQaseProjectCodes, setSelectedQaseProjectCodes] = useState<string[]>([]);
  const [loadingQaseProjects, setLoadingQaseProjects] = useState(false);
  const [qaseProjectsError, setQaseProjectsError] = useState<string | null>(null);
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(clientId ?? null);

  const selectedProjects = useMemo(
    () => qaseProjects.filter((project) => selectedQaseProjectCodes.includes(project.code)),
    [qaseProjects, selectedQaseProjectCodes],
  );

  if (!open) return null;

  function resetQaseSelection() {
    setQaseProjectCode("");
    setQaseProjects([]);
    setSelectedQaseProjectCodes([]);
    setQaseProjectsError(null);
  }

  function resetForm() {
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
    resetQaseSelection();
    setJiraBaseUrl("");
    setJiraEmail("");
    setJiraApiToken("");
    setError(null);
  }

  function toggleSelectedQaseProject(code: string) {
    setSelectedQaseProjectCodes((current) => {
      const exists = current.includes(code);
      const next = exists ? current.filter((item) => item !== code) : [...current, code];
      if (!exists && !qaseProjectCode) {
        setQaseProjectCode(code);
      }
      if (exists && qaseProjectCode === code) {
        setQaseProjectCode(next[0] ?? "");
      }
      return next;
    });
  }

  function selectAllQaseProjects() {
    const next = qaseProjects.map((project) => project.code);
    setSelectedQaseProjectCodes(next);
    if (!qaseProjectCode && next[0]) {
      setQaseProjectCode(next[0]);
    }
  }

  function clearQaseProjects() {
    setSelectedQaseProjectCodes([]);
    setQaseProjectCode("");
  }

  async function handleFetchQaseProjects() {
    const token = qaseToken.trim();
    if (!token) {
      setQaseProjectsError("Informe o token da Qase antes de buscar os projetos.");
      return;
    }

    setLoadingQaseProjects(true);
    setQaseProjectsError(null);
    try {
      const res = await fetch("/api/admin/qase/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => null)) as { items?: QaseProjectOption[]; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Nao foi possivel consultar os projetos da Qase.");
      }

      const items = Array.isArray(data?.items)
        ? data.items
            .filter((item) => item && typeof item.code === "string")
            .map((item) => ({
              code: item.code.trim().toUpperCase(),
              title: item.title?.trim() || item.code.trim().toUpperCase(),
            }))
        : [];

      setQaseProjects(items);
      setSelectedQaseProjectCodes((current) => {
        const valid = new Set(items.map((item) => item.code));
        const preserved = current.filter((code) => valid.has(code));
        if (preserved.length > 0) return preserved;
        if (items.length === 1) return [items[0].code];
        return [];
      });
      setQaseProjectCode((current) => {
        if (current && items.some((item) => item.code === current)) return current;
        if (items.length === 1) return items[0].code;
        return "";
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao buscar projetos na Qase.";
      setQaseProjects([]);
      setSelectedQaseProjectCodes([]);
      setQaseProjectCode("");
      setQaseProjectsError(message);
    } finally {
      setLoadingQaseProjects(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }

    if (integrationMode === "qase") {
      const token = qaseToken.trim();
      const selectedCodes = uniqCodes(selectedQaseProjectCodes);
      const primaryProject = qaseProjectCode.trim().toUpperCase();

      if (!token) {
        setError("Informe o token da Qase ou selecione 'Sem integracao no momento'.");
        return;
      }
      if (!selectedCodes.length) {
        setError("Busque os projetos na Qase e selecione ao menos uma aplicacao.");
        return;
      }
      if (!primaryProject || !selectedCodes.includes(primaryProject)) {
        setError("Selecione o projeto principal da integracao.");
        return;
      }
    }

    const jiraUrl = jiraBaseUrl.trim();
    const jiraMail = jiraEmail.trim();
    const jiraToken = jiraApiToken.trim();
    const hasAnyJira = Boolean(jiraUrl || jiraMail || jiraToken);

    if (hasAnyJira) {
      if (!jiraUrl) {
        setError("Informe a URL base do Jira ou limpe os campos do Jira.");
        return;
      }
      if (!/^https?:\/\//i.test(jiraUrl)) {
        setError("A URL do Jira deve comecar com http:// ou https://.");
        return;
      }
      if (!jiraMail) {
        setError("Informe o e-mail ou usuario do Jira.");
        return;
      }
      if (!jiraToken) {
        setError("Informe o API token do Jira.");
        return;
      }
    }

    setBusy(true);
    try {
      const selectedCodes = uniqCodes(selectedQaseProjectCodes);
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
        qaseProjectCode: integrationMode === "qase" ? qaseProjectCode.trim().toUpperCase() || undefined : undefined,
        qaseProjectCodes: integrationMode === "qase" ? selectedCodes : undefined,
        jiraBaseUrl: jiraUrl || undefined,
        jiraEmail: jiraMail || undefined,
        jiraApiToken: jiraToken || undefined,
      });

      if (result === null || result === undefined) return;

      const newId = readId(result) ?? createdClientId;
      setCreatedClientId(newId);
      resetForm();
      onClose();
      toast.success("Empresa cadastrada");
      if (newId && onOpenUser) {
        onOpenUser(newId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cadastrar empresa";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-4">
      <form
        aria-label="Cadastrar empresa"
        onSubmit={handleSubmit}
        className="w-full max-w-3xl max-h-[calc(100vh-48px)] space-y-4 overflow-y-auto rounded-xl border border-(--tc-border) bg-(--tc-surface) p-4 text-(--tc-text) shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-(--tc-accent)">Empresa</p>
            <h3 className="text-xl font-semibold text-(--tc-text)">Cadastrar empresa</h3>
            <p className="text-sm text-(--tc-text-muted)">Preencha os dados principais e configure a integracao se necessario.</p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-lg text-(--tc-text-muted) hover:bg-(--tc-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            onClick={() => {
              resetForm();
              onClose();
            }}
            aria-label="Fechar modal"
          >
            x
          </button>
        </div>

        {error ? (
          <div role="alert" className="rounded-lg border border-(--tc-accent) bg-(--tc-accent-soft) px-3 py-2 text-sm text-(--tc-text)">
            {error}
          </div>
        ) : null}

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
            Upload de logo
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setLogoFileName(file?.name ?? "");
              }}
            />
            {logoFileName ? <p className="mt-1 text-xs text-(--tc-text-muted)">Selecionado: {logoFileName}</p> : null}
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
            <legend className="px-1 text-sm font-semibold text-(--tc-text)">Integracao</legend>
            <p className="mt-1 text-xs text-(--tc-text-muted)">
              Se a empresa tiver Qase, informe o token, busque os projetos e selecione as aplicacoes. Cada projeto selecionado sera tratado como uma aplicacao separada no painel, permitindo gerenciar diferentes produtos ou softwares de forma independente.
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
                  <span className="font-medium">Sem integracao no momento</span>
                  <span className="block text-xs text-(--tc-text-muted)">Entrada manual de run, aplicacoes e kanban.</span>
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
                  <span className="block text-xs text-(--tc-text-muted)">Token + selecao dos projetos reais da conta.</span>
                </span>
              </label>
            </div>

            {integrationMode === "qase" ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="block text-sm">
                    Token da Qase
                    <input
                      className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                      type="password"
                      value={qaseToken}
                      onChange={(e) => {
                        setQaseToken(e.target.value);
                        resetQaseSelection();
                      }}
                      placeholder="Token da conta"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>

                  <button
                    type="button"
                    className="mt-6 rounded-lg border border-(--tc-accent) px-4 py-2 text-sm font-semibold text-(--tc-accent) transition hover:bg-(--tc-accent-soft) disabled:opacity-60"
                    onClick={() => void handleFetchQaseProjects()}
                    disabled={loadingQaseProjects}
                  >
                    {loadingQaseProjects ? "Buscando..." : "Buscar projetos"}
                  </button>
                </div>

                {qaseProjectsError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {qaseProjectsError}
                  </div>
                ) : null}

                {qaseProjects.length > 0 ? (
                  <div className="space-y-3 rounded-xl border border-(--tc-border) bg-(--tc-surface) p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-(--tc-text)">Projetos encontrados</p>
                        <p className="text-xs text-(--tc-text-muted)">
                          {selectedQaseProjectCodes.length} de {qaseProjects.length} selecionado(s). Cada projeto vira uma aplicacao independente no painel, com suas proprias runs, metricas e kanban.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-(--tc-border) px-3 py-1 text-xs font-semibold text-(--tc-text-secondary) hover:bg-(--tc-surface-2)"
                          onClick={selectAllQaseProjects}
                        >
                          Selecionar todos
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-(--tc-border) px-3 py-1 text-xs font-semibold text-(--tc-text-secondary) hover:bg-(--tc-surface-2)"
                          onClick={clearQaseProjects}
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {qaseProjects.map((project) => (
                        <label
                          key={project.code}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition ${
                            selectedQaseProjectCodes.includes(project.code)
                              ? "border-(--tc-accent) bg-(--tc-accent-soft)"
                              : "border-(--tc-border) bg-(--tc-surface-2)"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedQaseProjectCodes.includes(project.code)}
                            onChange={() => toggleSelectedQaseProject(project.code)}
                          />
                          <span className="min-w-0">
                            <span className="block font-semibold text-(--tc-text)">{project.title}</span>
                            <span className="block text-xs uppercase tracking-[0.2em] text-(--tc-text-muted)">{project.code}</span>
                          </span>
                        </label>
                      ))}
                    </div>

                    <label className="block text-sm">
                      Projeto principal
                      <select
                        className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) px-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                        value={qaseProjectCode}
                        onChange={(e) => {
                          const code = e.target.value;
                          setQaseProjectCode(code);
                          setSelectedQaseProjectCodes((current) => (current.includes(code) ? current : [...current, code]));
                        }}
                        disabled={selectedProjects.length === 0}
                      >
                        <option value="">{selectedProjects.length ? "Selecione o projeto principal" : "Selecione primeiro os projetos"}</option>
                        {selectedProjects.map((project) => (
                          <option key={project.code} value={project.code}>
                            {project.title} ({project.code})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-(--tc-border) bg-(--tc-surface) px-3 py-3 text-sm text-(--tc-text-muted)">
                    Informe o token e clique em &quot;Buscar projetos&quot; para selecionar as aplicacoes da empresa. Cada projeto da Qase sera cadastrado como uma aplicacao independente.
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4 rounded-lg border border-(--tc-border) bg-(--tc-surface) p-3">
              <p className="text-sm font-semibold text-(--tc-text)">Jira (opcional)</p>
              <p className="mt-1 text-xs text-(--tc-text-muted)">Se quiser, ja deixe o Jira configurado para esta empresa.</p>
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
                  E-mail / usuario
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

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            className="rounded-lg border border-(--tc-border) bg-(--tc-surface) px-4 py-2 text-sm text-(--tc-text) hover:bg-(--tc-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-(--tc-accent,#ef0001) px-4 py-2 text-sm font-semibold text-(--tc-text-inverse,#ffffff) hover:bg-(--tc-accent-hover,#c80001) disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
            disabled={busy}
          >
            {busy ? "Salvando..." : "Salvar empresa"}
          </button>
        </div>
      </form>
    </div>
  );
}
