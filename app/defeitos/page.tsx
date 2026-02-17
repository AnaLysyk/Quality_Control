"use client";

import { useEffect, useState } from "react";

interface Defeito {
  id: string;
  titulo: string;
  descricao: string;
  runId: string;
}

interface Run {
  id: string;
  nome: string;
}

export default function DefeitosPage() {
  const [defeitos, setDefeitos] = useState<Defeito[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [editing, setEditing] = useState<Defeito | null>(null);
  const [form, setForm] = useState({ titulo: "", descricao: "", runId: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDefeitos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/defeitos");
      const data = await res.json();
      setDefeitos(data.defects || []);
    } catch (err) {
      setError("Erro ao carregar defeitos");
    } finally {
      setLoading(false);
    }
  }

  async function fetchRuns() {
    try {
      const res = await fetch("/api/runs");
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {}
  }

  useEffect(() => {
    fetchDefeitos();
    fetchRuns();
  }, []);

  function limpar() {
    setEditing(null);
    setForm({ titulo: "", descricao: "", runId: "" });
    setError(null);
  }

  function cancelar() {
    limpar();
  }

  function editar(defeito: Defeito) {
    setEditing(defeito);
    setForm({ titulo: defeito.titulo, descricao: defeito.descricao, runId: defeito.runId });
  }

  async function deletar(id: string) {
    if (!window.confirm("Deseja deletar este defeito?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/defeitos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchDefeitos();
      limpar();
    } catch {
      setError("Erro ao deletar defeito");
    } finally {
      setLoading(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (editing) {
        await fetch("/api/defeitos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...editing, ...form }),
        });
      } else {
        await fetch("/api/defeitos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      fetchDefeitos();
      limpar();
    } catch {
      setError("Erro ao salvar defeito");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Defeitos</h1>
      <form className="space-y-3 mb-6" onSubmit={salvar}>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Título do defeito"
          value={form.titulo}
          onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
          required
        />
        <textarea
          className="w-full border rounded px-3 py-2"
          placeholder="Descrição"
          value={form.descricao}
          onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
        />
        <select
          className="w-full border rounded px-3 py-2"
          value={form.runId}
          onChange={e => setForm(f => ({ ...f, runId: e.target.value }))}
          aria-label="Run relacionada"
          required
        >
          <option value="">Selecione a run</option>
          {runs.map(run => (
            <option key={run.id} value={run.id}>{run.nome}</option>
          ))}
        </select>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
            {editing ? "Salvar" : "Criar"}
          </button>
          <button type="button" className="bg-gray-400 text-white px-4 py-2 rounded" onClick={cancelar} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="bg-yellow-500 text-white px-4 py-2 rounded" onClick={limpar} disabled={loading}>
            Limpar
          </button>
        </div>
      </form>
      <ul className="space-y-2">
        {defeitos.map(defeito => (
          <li key={defeito.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold">{defeito.titulo}</div>
              <div className="text-sm text-gray-600">{defeito.descricao}</div>
              <div className="text-xs text-gray-500">Run: {runs.find(r => r.id === defeito.runId)?.nome || 'Desconhecida'}</div>
            </div>
            <div className="flex gap-2">
              <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={() => editar(defeito)} disabled={loading}>
                Editar
              </button>
              <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => deletar(defeito.id)} disabled={loading}>
                Deletar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
