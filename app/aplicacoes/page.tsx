"use client";

import { useEffect, useState } from "react";

interface App {
  id: string;
  nome: string;
  descricao: string;
}

export default function AplicacoesPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [editing, setEditing] = useState<App | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchApps() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/aplicacoes");
      const data = await res.json();
      setApps(data.apps || []);
    } catch (err) {
      setError("Erro ao carregar aplicações");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchApps();
  }, []);

  function limpar() {
    setEditing(null);
    setForm({ nome: "", descricao: "" });
    setError(null);
  }

  function cancelar() {
    limpar();
  }

  function editar(app: App) {
    setEditing(app);
    setForm({ nome: app.nome, descricao: app.descricao });
  }

  async function deletar(id: string) {
    if (!window.confirm("Deseja deletar esta aplicação?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/aplicacoes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchApps();
      limpar();
    } catch {
      setError("Erro ao deletar aplicação");
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
        await fetch("/api/aplicacoes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...editing, ...form }),
        });
      } else {
        await fetch("/api/aplicacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      fetchApps();
      limpar();
    } catch {
      setError("Erro ao salvar aplicação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Aplicações</h1>
      <form className="space-y-3 mb-6" onSubmit={salvar}>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Nome"
          value={form.nome}
          onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          required
        />
        <textarea
          className="w-full border rounded px-3 py-2"
          placeholder="Descrição"
          value={form.descricao}
          onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
        />
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
        {apps.map(app => (
          <li key={app.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold">{app.nome}</div>
              <div className="text-sm text-gray-600">{app.descricao}</div>
            </div>
            <div className="flex gap-2">
              <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={() => editar(app)} disabled={loading}>
                Editar
              </button>
              <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => deletar(app.id)} disabled={loading}>
                Deletar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
