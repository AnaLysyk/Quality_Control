"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { FiCheck, FiCloudLightning, FiEye, FiEyeOff, FiLink2, FiSearch, FiZap } from "react-icons/fi";

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
  qase_projects?: { code: string; title?: string; imageUrl?: string | null; status?: "unknown" | "valid" | "invalid" }[];
  jiraBaseUrl?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  integrations?: { type: string; config?: Record<string, unknown> }[];
};

type ProjectStatus = "unknown" | "valid" | "invalid";

type QaseProjectOption = {
  code: string;
  title: string;
  status?: ProjectStatus;
  imageUrl?: string | null;
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
  // integrationMode removed: Qase fields are always visible
  const [qaseToken, setQaseToken] = useState("");
  const [showQaseToken, setShowQaseToken] = useState(false);
  const [qaseProjectCode, setQaseProjectCode] = useState("");
  const [qaseProjects, setQaseProjects] = useState<QaseProjectOption[]>([]);
  const [selectedQaseProjectCodes, setSelectedQaseProjectCodes] = useState<string[]>([]);
  const [loadingQaseProjects, setLoadingQaseProjects] = useState(false);
  const [qaseProjectsError, setQaseProjectsError] = useState<string | null>(null);
  const [testingQase, setTestingQase] = useState(false);
  const [qaseTestStatus, setQaseTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [qaseTestMessage, setQaseTestMessage] = useState<string | null>(null);
  const [searchProjects, setSearchProjects] = useState("");
  const [showAddManual, setShowAddManual] = useState(false);
  const [onlyValid, setOnlyValid] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const projectsRef = useRef<HTMLDivElement | null>(null);
  const [validatingProjects, setValidatingProjects] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(clientId ?? null);
  const [loadingClient, setLoadingClient] = useState(false);

  const selectedProjects = useMemo(
    () => qaseProjects.filter((project) => selectedQaseProjectCodes.includes(project.code)),
    [qaseProjects, selectedQaseProjectCodes],
  );

  if (!open) return null;

  useEffect(() => {
    if (!clientId) return;
    let mounted = true;
    (async () => {
      setLoadingClient(true);
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId as string)}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        if (!mounted) return;
        // populate fields
        setName((data.name as string) ?? "");
        setTaxId((data.tax_id as string) ?? "");
        setZip((data.cep as string) ?? "");
        setAddress((data.address as string) ?? "");
        setPhone((data.phone as string) ?? "");
        setWebsite((data.website as string) ?? "");
        setLogoUrl((data.logo_url as string) ?? "");
        setLinkedin((data.linkedin_url as string) ?? "");
        setNotes((data.notes as string) ?? "");
        setDescription((data.short_description as string) ?? "");
        setActive(typeof data.active === "boolean" ? data.active : true);
        setQaseToken((data.qase_token as string) ?? "");
        const codes = Array.isArray(data.qase_project_codes) ? data.qase_project_codes.map((c: any) => (typeof c === "string" ? c : String(c))) : [];
        setSelectedQaseProjectCodes(codes.map((c: string) => c.trim().toUpperCase()));
        setQaseProjectCode((data.qase_project_code as string) ?? (codes?.[0] ?? ""));
      } catch {
        // ignore
      } finally {
        setLoadingClient(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientId]);

  // close projects dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!projectsOpen) return;
      const el = projectsRef.current;
      if (!el) return;
      if (e.target && el.contains(e.target as Node)) return;
      setProjectsOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProjectsOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [projectsOpen]);

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
        body: JSON.stringify({ token, all: true }),
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
              status: "valid" as ProjectStatus,
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

  async function validateProjectCode(token: string, code: string) {
    try {
      const res = await fetch("/api/admin/qase/projects/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, code }),
      });
      const data = await res.json().catch(() => null);
      return res.ok && data?.valid === true;
    } catch {
      return false;
    }
  }

  function addManualProject() {
    const code = (manualCode || "").trim().toUpperCase();
    const name = (manualName || "").trim() || code;
    if (!code) {
      setQaseProjectsError("Informe o codigo do projeto Qase.");
      return;
    }
    // avoid duplicates
    if (qaseProjects.some((p) => p.code === code) || selectedQaseProjectCodes.includes(code)) {
      setQaseProjectsError("Projeto ja adicionado.");
      return;
    }
    const project: QaseProjectOption = { code, title: name, status: "unknown" };
    setQaseProjects((prev) => [...prev, project]);
    setSelectedQaseProjectCodes((prev) => [...prev, code]);
    if (!qaseProjectCode) setQaseProjectCode(code);
    setManualCode("");
    setManualName("");
    setShowAddManual(false);
    setQaseProjectsError(null);
    // try validate in background
    (async () => {
      const token = qaseToken.trim();
      if (!token) return;
      const ok = await validateProjectCode(token, code);
      setQaseProjects((prev) => prev.map((p) => (p.code === code ? { ...p, status: ok ? "valid" : "invalid" } : p)));
    })();
  }

  useEffect(() => {
    const hasPending = qaseProjects.some((p) => !p.status || p.status === "unknown");
    const token = qaseToken.trim();
    if (qaseProjects.length > 0 && hasPending && token && !validatingProjects) {
      void validatePendingProjects();
    }
    // only when qaseProjects or qaseToken changes
  }, [qaseProjects, qaseToken]);

  async function validatePendingProjects() {
    const token = qaseToken.trim();
    if (!token) {
      setQaseProjects((prev) => prev.map((p) => (p.status ? p : { ...p, status: "unknown" })));
      return;
    }
    setValidatingProjects(true);
    try {
      for (const project of qaseProjects) {
        if (project.status === "valid" || project.status === "invalid") continue;
        try {
          // validate sequentially to avoid burst
          // eslint-disable-next-line no-await-in-loop
          const ok = await validateProjectCode(token, project.code);
          setQaseProjects((prev) => prev.map((p) => (p.code === project.code ? { ...p, status: ok ? "valid" : "invalid" } : p)));
        } catch {
          setQaseProjects((prev) => prev.map((p) => (p.code === project.code ? { ...p, status: "unknown" } : p)));
        }
      }
    } finally {
      setValidatingProjects(false);
    }
  }

  function removeSelectedProject(code: string) {
    setSelectedQaseProjectCodes((current) => current.filter((c) => c !== code));
    if (qaseProjectCode === code) {
      const remaining = selectedQaseProjectCodes.filter((c) => c !== code);
      setQaseProjectCode(remaining[0] ?? "");
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

    // Validate Qase-related fields only when user selected projects or provided a token
    {
      const token = qaseToken.trim();
      const selectedCodes = uniqCodes(selectedQaseProjectCodes);
      const primaryProject = qaseProjectCode.trim().toUpperCase();

      if (selectedCodes.length > 0) {
        if (!token) {
          setError("Informe o token da Qase para vincular projetos.");
          return;
        }
        if (!primaryProject || !selectedCodes.includes(primaryProject)) {
          setError("Selecione o projeto principal da integracao.");
          return;
        }
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
      const qaseProjectsPayload = selectedProjects.map((p) => ({ code: p.code, title: p.title, imageUrl: p.imageUrl ?? null, status: p.status ?? "unknown" }));
      const integrationsPayload: { type: string; config?: Record<string, unknown> }[] = [];
      // build integrations array for multi-integration support
      if (qaseToken.trim() || (selectedCodes.length > 0)) {
        integrationsPayload.push({ type: "QASE", config: { token: qaseToken.trim() || null, projects: selectedCodes.length ? selectedCodes : undefined } });
      }
      if (jiraUrl || jiraMail || jiraToken) {
        integrationsPayload.push({ type: "JIRA", config: { baseUrl: jiraUrl || null, email: jiraMail || null, apiToken: jiraToken || null } });
      }

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
        integrationMode: selectedCodes.length || qaseToken.trim() ? "qase" : "manual",
        qaseToken: qaseToken.trim() || undefined,
        qaseProjectCode: selectedCodes.length ? (selectedCodes[0] || "").trim().toUpperCase() : undefined,
        qaseProjectCodes: Array.isArray(selectedCodes) ? selectedCodes : [],
        qase_projects: qaseProjectsPayload.length ? qaseProjectsPayload : undefined,
        jiraBaseUrl: jiraUrl || undefined,
        jiraEmail: jiraMail || undefined,
        jiraApiToken: jiraToken || undefined,
        integrations: integrationsPayload.length ? integrationsPayload : undefined,
      });

      if (result === null || result === undefined) return;

      const newId = readId(result) ?? createdClientId;
      setCreatedClientId(newId);
      resetForm();
      onClose();
      try {
        const messages: string[] = [];
        if (qaseToken.trim()) messages.push("Token salvo");
        if (Array.isArray(selectedQaseProjectCodes) && selectedQaseProjectCodes.length) messages.push(`Projetos vinculados: ${selectedQaseProjectCodes.length}`);
        if (newId) {
          try {
            const appsRes = await fetch(`/api/applications?companySlug=${encodeURIComponent(newId)}`);
            if (appsRes.ok) {
              const appsJson = await appsRes.json().catch(() => null);
              const apps = Array.isArray(appsJson?.items) ? appsJson.items : [];
              if (apps.length) messages.push(`Aplicações geradas: ${apps.length}`);
            }
          } catch {
            // ignore
          }
        }
        if (messages.length) {
          toast.success(messages.join(" — "));
        } else {
          toast.success("Empresa cadastrada");
        }
      } catch {
        toast.success("Empresa cadastrada");
      }

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
            Upload de logo 📤
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

          <fieldset className="md:col-span-2 rounded-xl border-2 border-(--tc-accent)/20 bg-[linear-gradient(180deg,var(--tc-surface-2)_0%,rgba(239,0,1,0.03)_100%)] p-4">
            <legend className="flex items-center gap-2 px-2 text-sm font-bold text-(--tc-text)">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-(--tc-accent,#ef0001) text-white"><FiLink2 size={12} /></span>
              Integracao
            </legend>
            <p className="mt-1 text-xs leading-5 text-(--tc-text-muted)">
              Se a empresa tiver Qase, informe o token, busque os projetos e selecione as aplicacoes. Cada projeto selecionado sera tratado como uma aplicacao separada no painel, permitindo gerenciar diferentes produtos ou softwares de forma independente.
            </p>

            <div className="mt-3">
              <p className="text-sm font-semibold text-(--tc-text)"><FiZap size={13} className="text-(--tc-accent,#ef0001)" /> Integração com Qase</p>
              <p className="mt-1 text-xs text-(--tc-text-muted)">Informe o token da Qase (novo ou já salvo) e clique em "Buscar projetos" para carregar os projetos disponíveis. Selecione os projetos que deseja vincular — cada projeto selecionado será cadastrado como uma aplicação da empresa.</p>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] items-center">
                <label className="block text-sm sm:col-span-2">
                  Token da Qase
                  <div className="relative mt-2">
                    <input
                      className="w-full h-10 rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#fff) px-3 pr-10 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)"
                      type={showQaseToken ? "text" : "password"}
                      value={qaseToken}
                      onChange={(e) => {
                        setQaseToken(e.target.value);
                        resetQaseSelection();
                      }}
                      placeholder="Token da conta"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setShowQaseToken((v) => !v)}
                      className="absolute right-3 top-3 flex items-center text-(--tc-text-muted) hover:text-(--tc-text)"
                      aria-label={showQaseToken ? "Esconder token" : "Mostrar token"}
                      tabIndex={-1}
                    >
                      {showQaseToken ? <FiEyeOff size={16} aria-hidden /> : <FiEye size={16} aria-hidden />}
                    </button>
                  </div>
                </label>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 h-10 rounded-lg bg-linear-to-b from-(--tc-accent,#ff4b4b) to-(--tc-accent-dark,#c30000) px-4 text-sm font-semibold text-white shadow-lg transition duration-150 hover:opacity-95 disabled:opacity-60"
                  onClick={() => void handleFetchQaseProjects()}
                  disabled={loadingQaseProjects || !qaseToken}
                >
                  <FiSearch size={14} />
                  {loadingQaseProjects ? "Buscando..." : "Buscar projetos"}
                </button>
              </div>

              {!qaseToken ? (
                <div className="mt-2 text-sm text-amber-600">Sem token da Qase configurado</div>
              ) : null}

                {qaseProjectsError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {qaseProjectsError}
                  </div>
                ) : null}

                {qaseTestMessage ? (
                  <div className={`mt-2 rounded-md px-3 py-2 text-sm ${qaseTestStatus === "ok" ? "border border-green-200 bg-green-50 text-green-800" : "border border-rose-200 bg-rose-50 text-rose-800"}`}>
                    {qaseTestMessage}
                  </div>
                ) : null}

                {qaseProjects.length > 0 ? (
                  <div className="space-y-4 rounded-xl border border-(--tc-border) bg-(--tc-surface) p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-sm font-semibold text-(--tc-text)"><FiCloudLightning size={14} className="text-(--tc-accent,#ef0001)" /> Projetos encontrados</p>
                        <p className="mt-1 text-xs text-(--tc-text-muted)">Selecione os projetos que deseja vincular — cada projeto vira uma aplicação independente.</p>
                      </div>
                      <div className="text-sm text-(--tc-text-muted)">{Math.min(displayLimit, qaseProjects.filter((p) => {
                        const q = searchProjects.trim().toLowerCase();
                        if (onlyValid && p.status !== "valid") return false;
                        if (!q) return true;
                        return p.code.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q);
                      }).length)} carregados • {selectedProjects.length} selecionado{selectedProjects.length !== 1 ? "s" : ""}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-(--tc-text-muted)" />
                        <input value={searchProjects} onChange={(e) => setSearchProjects(e.target.value)} placeholder="Filtrar projetos" className="mt-1 w-full rounded-lg border border-(--tc-border) bg-(--tc-input-bg,#eef4ff) pl-10 pr-3 py-2 text-sm text-(--tc-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tc-focus)" />
                      </div>
                      <label className="ml-2 flex items-center gap-2 text-xs text-(--tc-text-muted)">
                        <input type="checkbox" checked={onlyValid} onChange={(e) => setOnlyValid(e.target.checked)} className="h-4 w-4" />
                        <span>Mostrar apenas válidos</span>
                      </label>
                    </div>

                    <div className="grid gap-2">
                      {(() => {
                        const filtered = qaseProjects.filter((p) => {
                          const q = searchProjects.trim().toLowerCase();
                          if (onlyValid && p.status !== "valid") return false;
                          if (!q) return true;
                          return p.code.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q);
                        });
                        const visible = filtered.slice(0, displayLimit);
                        return visible.map((project) => {
                          const isSelected = selectedQaseProjectCodes.includes(project.code);
                          return (
                            <label
                              key={project.code}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-sm transition border ${isSelected ? "border-2 border-(--tc-accent,#ef0001) bg-(--tc-accent-soft,rgba(255,230,230,0.9))" : "border-transparent hover:border-(--tc-border) hover:bg-(--tc-surface-2)"}`}
                            >
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelectedQaseProject(project.code)} className="h-5 w-5" />
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-(--tc-surface-2) text-(--tc-text-muted)"><FiCloudLightning size={14} /></span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="block font-semibold text-(--tc-text)">{project.title}</span>
                                    {project.status && (
                                      <span className={`text-xs font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${project.status === "valid" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : project.status === "invalid" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                                        {project.status === "valid" ? "Válido" : project.status === "invalid" ? "Inválido" : "Pendente"}
                                      </span>
                                    )}
                                  </div>
                                  <span className="block text-xs text-(--tc-text-muted)">{project.code}</span>
                                </div>
                              </div>
                            </label>
                          );
                        });
                      })()}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs text-(--tc-text-muted)">Exibindo {Math.min(displayLimit, qaseProjects.filter((p) => {
                        const q = searchProjects.trim().toLowerCase();
                        if (onlyValid && p.status !== "valid") return false;
                        if (!q) return true;
                        return p.code.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q);
                      }).length)} de {qaseProjects.length} carregados</div>
                      <div className="flex items-center gap-2">
                        {qaseProjects.filter((p) => {
                          const q = searchProjects.trim().toLowerCase();
                          if (onlyValid && p.status !== "valid") return false;
                          if (!q) return true;
                          return p.code.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q);
                        }).length > displayLimit ? (
                          <button type="button" onClick={() => setDisplayLimit((d) => d + 10)} className="rounded-md px-3 py-1 text-xs font-semibold text-(--tc-text) hover:bg-(--tc-surface-2)">Carregar mais</button>
                        ) : null}
                        <button type="button" onClick={() => setProjectsOpen(false)} className="rounded-md border px-3 py-1 text-xs font-semibold">Fechar</button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{selectedProjects.length} projeto{selectedProjects.length !== 1 ? "s" : ""} selecionado{selectedProjects.length !== 1 ? "s" : ""}</div>
                        {selectedProjects.length > 0 && <div className="text-xs text-(--tc-text-muted)">{selectedProjects.length} selecionado(s)</div>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {selectedProjects.map((p) => (
                          <span key={p.code} className="inline-flex items-center gap-3 rounded-full border-2 border-(--tc-accent,#ef0001) bg-(--tc-accent-soft,rgba(255,230,230,0.9)) px-4 py-2 text-sm shadow-sm">
                            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-white text-(--tc-accent,#ef0001)"><FiCheck size={14} /></div>
                            <div className="flex flex-col text-left">
                              <strong className="text-sm">{p.title}</strong>
                              <span className="text-xs text-(--tc-text-muted)">{p.code}</span>
                            </div>
                            <button type="button" onClick={() => removeSelectedProject(p.code)} className="ml-2 text-xs text-(--tc-text-muted)">x</button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm">Projeto principal
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
                            <option value="">{selectedProjects.length ? "Selecione o projeto principal" : "Selecione primeiro os projetos vinculados"}</option>
                            {selectedProjects.map((project) => (
                              <option key={project.code} value={project.code}>
                                {project.title} ({project.code})
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex flex-col justify-center">
                        <div className="text-sm font-medium">Aplicações que serão criadas</div>
                        <div className="mt-1 text-xs text-(--tc-text-muted)">{selectedProjects.length} aplicação{selectedProjects.length !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-(--tc-accent)/30 bg-(--tc-accent-soft,rgba(239,0,1,0.03)) px-4 py-4 text-sm text-(--tc-text-muted)">
                    <FiSearch size={18} className="shrink-0 text-(--tc-accent,#ef0001) opacity-60" />
                    <span>Informe o token e clique em "Buscar projetos" para selecionar as aplicações da empresa. Cada projeto da Qase será cadastrado como uma aplicação independente.</span>
                  </div>
                )}
              </div>
            

            <div className="mt-4 rounded-lg border border-(--tc-border) bg-(--tc-surface) p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-(--tc-text)"><span className="flex h-5 w-5 items-center justify-center rounded bg-(--tc-primary,#011848) text-white"><FiLink2 size={10} /></span>Jira (opcional)</p>
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
