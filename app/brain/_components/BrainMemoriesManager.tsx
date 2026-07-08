"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type BrainMemoryItem = {
  id: string;
  title: string;
  summary: string;
  memoryType: string;
  importance: number;
  status: string;
  sourceType?: string | null;
  sourceId?: string | null;
  nodeId?: string | null;
  node?: { id: string; label: string; type: string } | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

type BrainAuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  createdAt: string;
};

const MEMORY_TYPES = ["RULE", "DECISION", "PATTERN", "CONTEXT", "EXCEPTION", "TECHNICAL_NOTE", "QA_NOTE", "SYSTEM_EVENT"];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha na requisicao");
  return json as T;
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function BrainMemoriesManager() {
  const [memories, setMemories] = useState<BrainMemoryItem[]>([]);
  const [audit, setAudit] = useState<BrainAuditItem[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [nodeId, setNodeId] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    memoryType: "CONTEXT",
    importance: "3",
    sourceType: "MANUAL",
    sourceId: "",
    nodeId: "",
  });

  const filteredMemories = useMemo(() => memories, [memories]);

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (type !== "all") params.set("type", type);
    if (nodeId.trim()) params.set("nodeId", nodeId.trim());
    if (source.trim()) params.set("source", source.trim());
    try {
      const [memoryData, auditData] = await Promise.all([
        fetchJson<{ memories: BrainMemoryItem[] }>(`/api/brain/memories?${params.toString()}`),
        fetchJson<{ logs?: BrainAuditItem[] }>(`/api/brain/audit?entityType=BrainMemory&limit=40`).catch(() => ({ logs: [] })),
      ]);
      setMemories(memoryData.memories ?? []);
      setAudit(auditData.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar memorias");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(memory: BrainMemoryItem) {
    setEditingId(memory.id);
    setForm({
      title: memory.title,
      summary: memory.summary,
      memoryType: memory.memoryType,
      importance: String(memory.importance),
      sourceType: memory.sourceType ?? "MANUAL",
      sourceId: memory.sourceId ?? "",
      nodeId: memory.nodeId ?? "",
    });
    setFeedback(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ title: "", summary: "", memoryType: "CONTEXT", importance: "3", sourceType: "MANUAL", sourceId: "", nodeId: "" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const payload = {
        ...form,
        importance: Number(form.importance),
        nodeId: form.nodeId.trim() || null,
        sourceId: form.sourceId.trim() || null,
      };
      if (editingId) {
        await fetchJson(`/api/brain/memories/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setFeedback("Memoria atualizada.");
      } else {
        await fetchJson("/api/brain/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setFeedback("Memoria criada.");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar memoria");
    } finally {
      setSaving(false);
    }
  }

  async function disable(memory: BrainMemoryItem) {
    setError(null);
    setFeedback(null);
    try {
      await fetchJson(`/api/brain/memories/${encodeURIComponent(memory.id)}/disable`, { method: "POST" });
      setFeedback("Memoria desativada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desativar memoria");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100">
      <section className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/70">Brain</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Memórias do Brain</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Area de suporte para consultar e manter o banco de contexto usado pelo Brain sem alterar dados operacionais.
            </p>
          </div>
          <button type="button" onClick={load} className="rounded-lg border border-cyan-200/30 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-200/10">
            Atualizar
          </button>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <section className="space-y-4">
            <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 md:grid-cols-4">
              <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar texto" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
              <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                <option value="all">Todos os tipos</option>
                {MEMORY_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input value={nodeId} onChange={(event) => setNodeId(event.target.value)} placeholder="Filtrar por nodeId" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
              <div className="flex gap-2">
                <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Fonte" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <button type="button" onClick={load} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Filtrar</button>
              </div>
            </div>

            {error ? <p className="rounded-lg border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
            {feedback ? <p className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{feedback}</p> : null}

            <div className="grid gap-3">
              {loading ? <p className="rounded-lg border border-white/10 p-5 text-sm text-slate-300">Carregando memorias...</p> : null}
              {!loading && filteredMemories.length === 0 ? <p className="rounded-lg border border-dashed border-white/15 p-5 text-sm text-slate-300">Nenhuma memoria encontrada neste escopo.</p> : null}
              {filteredMemories.map((memory) => (
                <article key={memory.id} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-300/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">{memory.memoryType}</span>
                        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">{memory.status}</span>
                        <span className="text-xs text-slate-400">Importancia {memory.importance}/5</span>
                      </div>
                      <h2 className="mt-3 text-lg font-black text-white">{memory.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{memory.summary}</p>
                      <p className="mt-3 text-xs text-slate-500">
                        {memory.node ? `No: ${memory.node.label} (${memory.node.type})` : "Sem no vinculado"} · Atualizada em {dateLabel(memory.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => startEdit(memory)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-white/10">Editar</button>
                      <button type="button" onClick={() => disable(memory)} className="rounded-lg border border-red-300/30 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/10">Desativar</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <form onSubmit={submit} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <h2 className="text-lg font-black">{editingId ? "Editar memoria" : "Nova memoria"}</h2>
              <div className="mt-4 grid gap-3">
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Titulo" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <textarea value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Resumo/contexto" rows={5} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <select value={form.memoryType} onChange={(event) => setForm((current) => ({ ...current, memoryType: event.target.value }))} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none">
                  {MEMORY_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <input value={form.nodeId} onChange={(event) => setForm((current) => ({ ...current, nodeId: event.target.value }))} placeholder="nodeId opcional" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))} placeholder="Fonte" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                  <input value={form.importance} onChange={(event) => setForm((current) => ({ ...current, importance: event.target.value }))} type="number" min="1" max="5" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none" />
                </div>
                <button disabled={saving} className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{saving ? "Salvando..." : editingId ? "Salvar edicao" : "Criar memoria"}</button>
                {editingId ? <button type="button" onClick={resetForm} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold">Cancelar edicao</button> : null}
              </div>
            </form>

            <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-300">Auditoria recente</h2>
              <div className="mt-3 grid gap-2">
                {audit.slice(0, 10).map((item) => (
                  <div key={item.id} className="rounded-lg bg-black/20 p-3 text-xs text-slate-300">
                    <p className="font-black text-white">{item.action}</p>
                    <p className="mt-1">{item.entityId} · {dateLabel(item.createdAt)}</p>
                  </div>
                ))}
                {!audit.length ? <p className="text-sm text-slate-400">Sem auditoria visivel neste escopo.</p> : null}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
