"use client";

export const dynamic = "force-dynamic";


import { useEffect, useState } from "react";
import CreateSupportTicketButton from "@/components/CreateSupportTicketButton";

interface Chamado {
  id: string;
  title: string;
  description: string;
  status?: string;
}

export default function ChamadosPage() {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [editing, setEditing] = useState<Chamado | null>(null);
  const [form, setForm] = useState({ title: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchChamados() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chamados");
      const data = await res.json();
      setChamados(data.items || []);
    } catch (err) {
      setError("Erro ao carregar chamados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchChamados();
  }, []);

  function limpar() {
    setEditing(null);
    setForm({ title: "", description: "" });
    setError(null);
  }

  function cancelar() {
    limpar();
  }

  function editar(chamado: Chamado) {
    setEditing(chamado);
    setForm({ title: chamado.title, description: chamado.description });
  }

  async function deletar(id: string) {
    if (!window.confirm("Deseja deletar este chamado?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetch(`/api/chamados/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      fetchChamados();
      limpar();
    } catch {
      setError("Erro ao deletar chamado");
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
        await fetch(`/api/chamados/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ...editing, ...form }),
        });
      } else {
        await fetch("/api/chamados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(form),
        });
      }
      fetchChamados();
      limpar();
    } catch {
      setError("Erro ao salvar chamado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 relative">
      <h1 className="text-2xl font-bold mb-4">Chamados</h1>
      {/* Botão flutuante para criar chamado */}
      <div className="fixed bottom-8 right-8 z-50">
        <CreateSupportTicketButton />
      </div>
      <form className="space-y-3 mb-6" onSubmit={salvar}>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Título do chamado"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          required
        />
        <textarea
          className="w-full border rounded px-3 py-2"
          placeholder="Descrição"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
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
        {chamados.map(chamado => (
          <li key={chamado.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold">{chamado.title}</div>
              <div className="text-sm text-gray-600">{chamado.description}</div>
              <div className="text-xs text-gray-500">Status: {chamado.status || 'aberto'}</div>
            </div>
            <div className="flex gap-2">
              <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={() => editar(chamado)} disabled={loading}>
                Editar
              </button>
              <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => deletar(chamado.id)} disabled={loading}>
                Deletar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
