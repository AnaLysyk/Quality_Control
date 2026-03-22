import React, { useEffect, useState } from "react";

// Lightweight local replacement for missing `useCompanyIntegration` hook.
function useCompanyIntegration(companyId: string) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetch(`/api/clients/${companyId}`)
      .then((res) => res.json().catch(() => null))
      .then((json) => {
        if (!mounted) return;
        if (!json) {
          setData(null);
          setError("Resposta invalida");
          return;
        }
        setData(typeof json === "object" && json ? (json as Record<string, unknown>) : null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setData(null);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [companyId]);

  return { data, loading, error, setData } as const;
}

interface CompanyIntegrationFormProps {
  companyId: string;
  variant?: "admin" | "company-profile";
}

export function CompanyIntegrationForm({ companyId, variant = "admin" }: CompanyIntegrationFormProps) {
  const { data, loading, error, setData } = useCompanyIntegration(companyId);
  const [form, setForm] = useState<{ qase_token?: string }>({ qase_token: undefined });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [projects, setProjects] = useState<Array<{ code: string; title: string }>>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  React.useEffect(() => {
    if (!data) {
      setForm({ qase_token: undefined });
      return;
    }
    const maybeToken = (data as Record<string, unknown>)?.qase_token;
    setForm({ qase_token: typeof maybeToken === "string" ? maybeToken : undefined });
    // initialize selected projects from loaded company (supports legacy single code)
    const existingCodes = (data as any)?.qase_project_codes;
    const legacyCode = (data as any)?.qase_project_code;
    if (Array.isArray(existingCodes) && existingCodes.length) {
      setSelectedProjects(existingCodes.map((c: any) => (typeof c === "string" ? c.trim().toUpperCase() : String(c).trim().toUpperCase())));
    } else if (typeof legacyCode === "string" && legacyCode.trim()) {
      setSelectedProjects([legacyCode.trim().toUpperCase()]);
    }
  }, [data]);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleFetchProjects() {
    if (!form.qase_token) {
      setMessage("Informe o token Qase antes de buscar projetos.");
      return;
    }
    setLoadingProjects(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/qase/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: form.qase_token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao buscar projetos");
      setProjects(Array.isArray(data.items) ? data.items : []);
      setMessage("Projetos carregados.");
    } catch (err: any) {
      setMessage(typeof err === "string" ? err : err?.message || "Erro ao buscar projetos");
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        qase_token: form.qase_token || undefined,
      };
      if (selectedProjects.length) payload.qase_project_codes = selectedProjects;
      const res = await fetch("/api/clients/" + companyId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const updated = await res.json().catch(() => null);
      setMessage("Dados salvos com sucesso.");
      if (updated && typeof updated === "object") {
        setData((prev: any) => ({ ...prev, ...updated }));
        // ensure local selectedProjects reflects persisted value
        const persisted = (updated as any).qase_project_codes ?? (updated as any).qase_project_code ? (Array.isArray((updated as any).qase_project_codes) ? (updated as any).qase_project_codes : [(updated as any).qase_project_code]) : undefined;
        if (Array.isArray(persisted)) {
          setSelectedProjects(persisted.map((c: any) => (typeof c === "string" ? c.trim().toUpperCase() : String(c).trim().toUpperCase())));
        }
      } else {
        setData((prev: any) => ({ ...prev, ...payload }));
        if (payload.qase_project_codes && Array.isArray(payload.qase_project_codes)) {
          setSelectedProjects(payload.qase_project_codes.map((c: any) => (typeof c === "string" ? c.trim().toUpperCase() : String(c).trim().toUpperCase())));
        }
      }
      setTokenSaved(Boolean(form.qase_token && form.qase_token.length > 0));
    } catch {
      setMessage("Erro ao salvar dados.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className={variant === "admin" ? "p-4 bg-white rounded shadow" : "p-4 bg-blue-50 rounded"}>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" htmlFor="qase_token">Token Qase</label>
        <div className="flex gap-2 items-center">
          <input name="qase_token" id="qase_token" type="password" value={form.qase_token || ""} onChange={handleChange} className="flex-1 h-10 rounded-lg border px-3 text-sm" autoComplete="off" placeholder="Token Qase" />
          <button type="button" onClick={handleFetchProjects} disabled={loadingProjects || !form.qase_token} className="inline-flex items-center gap-2 h-10 rounded-lg bg-linear-to-b from-(--tc-accent,#ff4b4b) to-(--tc-accent-dark,#c30000) px-4 text-sm font-semibold text-white shadow-lg transition duration-150 hover:opacity-95 disabled:opacity-60">
            {loadingProjects ? "Buscando..." : "Buscar Projetos"}
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-500">{projects.length ? `${projects.length} projetos` : "Nenhum projeto carregado"}</div>
        {!form.qase_token && !tokenSaved && !(data as any)?.qase_token ? (
          <div className="mt-2 text-sm text-amber-600">Sem token da Qase configurado</div>
        ) : null}
        {(!form.qase_token && tokenSaved) || ((data as any)?.qase_token && !form.qase_token) ? (
          <div className="mt-2 text-sm text-gray-700">Token salvo ●●●●●●●●</div>
        ) : null}
      </div>
      {projects.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" htmlFor="qase_projects_select">Projetos Qase</label>
          <select id="qase_projects_select" title="Projetos Qase" aria-label="Projetos Qase" multiple value={selectedProjects} onChange={(e) => setSelectedProjects(Array.from(e.target.selectedOptions, (o) => o.value))} className="w-full border rounded px-2 py-1 h-36">
            {projects.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} — {p.title}
              </option>
            ))}
          </select>
          <small className="text-xs text-gray-500">Segure Ctrl/Cmd para selecionar múltiplos</small>
        </div>
      )}
      <button type="submit" disabled={saving} className="mt-2 px-4 py-2 rounded bg-blue-600 text-white">
        {saving ? "Salvando..." : "Salvar"}
      </button>
      {message && <div className="mt-2 text-sm text-green-600">{message}</div>}
    </form>
  );
}

