"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchApi } from "@/lib/api";

type Project = { code: string; title?: string };

const fallbackProjects: Project[] = (process.env.NEXT_PUBLIC_QASE_PROJECTS || "SFQ,PRINT,Booking,CDS,GMT")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .map((code) => ({ code, title: code }));

export default function ReleaseManager() {
  const [projects, setProjects] = useState<Project[]>(fallbackProjects);
  const [project, setProject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"aceitacao" | "regressao">("aceitacao");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchApi("/api/v1/projects");
        const json = await res.json();
        type RawProject = { code?: string; project?: string; title?: string; name?: string };
        const rawList: RawProject[] = Array.isArray(json.data ?? json.projects) ? (json.data ?? json.projects) : [];
        const list: Project[] = rawList.map((p) => ({
          code: p.code || p.project || "",
          title: p.title || p.name || p.code || "",
        }));

        const map = new Map(list.map((item) => [item.code.toLowerCase(), item]));
        const normalized = fallbackProjects.map((fp) => {
          const found = map.get(fp.code.toLowerCase());
          return found ? { code: fp.code, title: found.title || fp.title } : fp;
        });

        setProjects(normalized.length ? normalized : list);
      } catch {
        setProjects(fallbackProjects);
      }
    };
    load();
  }, []);

  const canSubmit = useMemo(() => project.trim() !== "" && title.trim() !== "" && !loading, [project, title, loading]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetchApi("/api/v1/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          title,
          description,
          custom_type: type,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || "Falha ao criar run");
      }
      setStatus("Run criada com sucesso.");
      setTitle("");
      setDescription("");
      setType("aceitacao");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar run";
      setStatus(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1320] p-6 text-white space-y-4 w-full max-w-2xl">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-[#7CD343]">Gerenciar</p>
        <h2 className="text-2xl font-bold">Nova Run</h2>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span>Projeto</span>
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="w-full rounded-lg bg-[#0b1020] border border-white/10 px-3 py-2 text-white focus:border-[#7CD343] focus:outline-none"
          >
            <option value="">Selecione...</option>
            {projects.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code}
                {p.title ? ` - ${p.title}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>TÃ­tulo</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg bg-[#0b1020] border border-white/10 px-3 py-2 text-white focus:border-[#7CD343] focus:outline-none"
            placeholder="Ex.: Run 1.0 PRINT"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>DescriÃ§Ã£o</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-24 rounded-lg bg-[#0b1020] border border-white/10 px-3 py-2 text-white focus:border-[#7CD343] focus:outline-none"
            placeholder="Detalhes da run"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "aceitacao" | "regressao")}
            className="w-full rounded-lg bg-[#0b1020] border border-white/10 px-3 py-2 text-white focus:border-[#7CD343] focus:outline-none"
          >
            <option value="aceitacao">AceitaÃ§Ã£o</option>
            <option value="regressao">RegressÃ£o</option>
          </select>
        </label>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="inline-flex justify-center rounded-lg bg-[#7CD343] px-4 py-2 font-semibold text-[#0b1305] shadow-lg shadow-[#7CD343]/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar Run"}
        </button>

        {status && <p className="text-sm text-gray-200">{status}</p>}
      </div>
    </div>
  );
}
