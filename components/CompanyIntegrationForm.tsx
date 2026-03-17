import React, { useState } from "react";
import { useCompanyIntegration } from "@/hooks/useCompanyIntegration";

interface CompanyIntegrationFormProps {
  companyId: string;
  variant?: "admin" | "company-profile";
}

export function CompanyIntegrationForm({ companyId, variant = "admin" }: CompanyIntegrationFormProps) {
  const { data, loading, error, setData } = useCompanyIntegration(companyId);
  const [form, setForm] = useState<{ qase_token?: string }>({ qase_token: undefined });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{ code: string; title: string }>>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  React.useEffect(() => {
    setForm({ qase_token: data?.qase_token });
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
      await fetch("/api/clients/" + companyId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      setMessage("Dados salvos com sucesso.");
      setData((prev: any) => ({ ...prev, ...payload }));
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
        <input name="qase_token" id="qase_token" type="password" value={form.qase_token || ""} onChange={handleChange} className="w-full border rounded px-2 py-1" autoComplete="off" placeholder="Token Qase" />
      </div>
      <div className="flex gap-2 items-center mb-4">
        <button type="button" onClick={handleFetchProjects} disabled={loadingProjects || !form.qase_token} className="px-3 py-2 rounded bg-gray-200">
          {loadingProjects ? "Buscando..." : "Buscar Projetos"}
        </button>
        <span className="text-sm text-gray-500">{projects.length ? `${projects.length} projetos` : "Nenhum projeto carregado"}</span>
      </div>
      {projects.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Projetos Qase</label>
          <select multiple value={selectedProjects} onChange={(e) => setSelectedProjects(Array.from(e.target.selectedOptions, (o) => o.value))} className="w-full border rounded px-2 py-1 h-36">
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

