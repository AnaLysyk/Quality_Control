"use client";

import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiRefreshCcw } from "react-icons/fi";
import { fetchApi } from "@/lib/api";

type Defect = {
  id: number;
  title: string;
  status?: string;
  severity?: string | number;
  description?: string;
  project?: string;
  project_code?: string;
  application?: string;
};

const TAGS = [
  { id: "ALL", label: "Todas as aplicaÃ§Ãµes", color: "bg-gray-700" },
  { id: "SFQ", label: "SMART", color: "bg-green-600" },
  { id: "PRINT", label: "PRINT", color: "bg-blue-600" },
  { id: "BOOKING", label: "BOOKING", color: "bg-yellow-600" },
  { id: "CDS", label: "CIDADÃƒO SMART", color: "bg-red-600" },
  { id: "GMT", label: "GRIAULE MOBILE", color: "bg-teal-600" },
];

export default function DefectsPage() {
  const [items, setItems] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState("ALL");

  const normalizeProject = (value?: string) => {
    const upper = (value ?? "").toUpperCase();
    if (["SIDA", "SID", "CID", "CIT", "CIDA"].includes(upper)) return "CDS";
    return upper;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = project ? `?project=${encodeURIComponent(project)}` : "?project=ALL";
      const res = await fetchApi(`/api/v1/defects${query}`);
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error?.message || "Falha ao carregar defeitos");
      }
      const defects: Defect[] = json?.data ?? json?.defects ?? [];
      const normalized = Array.isArray(defects)
        ? defects.map((d) => ({
            ...d,
            project: normalizeProject(d.project),
            project_code: normalizeProject(d.project_code),
            application: d.application,
          }))
        : [];
      setItems(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const list = useMemo(() => items, [items]);

  return (
    <div className="min-h-screen text-white px-6 py-10 md:px-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-[#f97316]">Defeitos</p>
            <h1 className="text-3xl font-extrabold">Lista de Defeitos</h1>
            <p className="text-sm text-gray-300">Dados vindos da Qase via backend.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="project code (ex: GMT)"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-400"
              data-testid="defects-project-input"
            />
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition disabled:opacity-60"
              data-testid="defects-reload"
            >
              <FiRefreshCcw /> {loading ? "Atualizando..." : "Recarregar"}
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {TAGS.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setProject(tag.id)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white transition ${tag.color} ${
                project === tag.id ? "ring-2 ring-white/60 ring-offset-1 ring-offset-[#0f1626]" : ""
              }`}
            >
              {tag.label}
            </button>
          ))}
          <button
            onClick={() => setProject("ALL")}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white border border-white/20 bg-white/5 hover:bg-white/10 transition"
          >
            Limpar filtro
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {!error && !loading && list.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-gray-300">
            Nenhum defeito encontrado.
          </div>
        )}

        {list.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="defects-list">
            {list.map((defect) => (
              <article
                key={defect.id}
                className="kanban-card rounded-2xl border border-white/10 bg-[#0f1626]/80 p-5 shadow-[0_18px_38px_rgba(0,0,0,0.25)]"
                data-testid={`defect-${defect.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#f97316]">
                    <FiAlertTriangle /> DEFECT {defect.id}
                  </span>
                  <div className="flex flex-col items-end gap-1 text-[11px] text-gray-400 uppercase">
                    <span>{defect.status || "status N/D"}</span>
                    {defect.project && (
                      <span className="inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {normalizeProject(defect.project)}
                      </span>
                    )}
                  </div>
                </div>
                <h2 className="font-semibold text-white leading-snug text-lg line-clamp-2">
                  {defect.title || "Sem tÃ­tulo"}
                </h2>
                <p className="text-xs text-gray-400 mt-2 line-clamp-3">
                  {defect.description || "Sem descriÃ§Ã£o"}
                </p>
                <div className="mt-3 text-xs text-gray-300 flex items-center gap-2">
                  <span className="rounded-full border border-white/10 px-2 py-1">
                    Severidade: {defect.severity ?? "N/D"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
