"use client";

import { useEffect, useState } from "react";

interface TestPlan {
  id: string;
  nome: string;
  descricao: string;
}

interface KanbanItem {
  id: string;
  titulo: string;
  status: "backlog" | "em progresso" | "concluido";
}

export default function PlanosDeTestePage() {
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [editing, setEditing] = useState<TestPlan | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kanban state
  const [kanban, setKanban] = useState<KanbanItem[]>([]);
  const [kanbanForm, setKanbanForm] = useState({ titulo: "", status: "backlog" as KanbanItem["status"] });
  const [editingKanban, setEditingKanban] = useState<KanbanItem | null>(null);

  async function fetchPlans() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/planos-de-teste");
      const data = await res.json();
      setPlans(data.testPlans || []);
    } catch (err) {
      setError("Erro ao carregar planos de teste");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlans();
  }, []);

  function limpar() {
    setEditing(null);
    setForm({ nome: "", descricao: "" });
    setError(null);
  }

  function cancelar() {
    limpar();
  }

  function editar(plan: TestPlan) {
    setEditing(plan);
    setForm({ nome: plan.nome, descricao: plan.descricao });
  }

  async function deletar(id: string) {
    if (!window.confirm("Deseja deletar este plano de teste?")) return;
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/planos-de-teste", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchPlans();
      limpar();
    } catch {
      setError("Erro ao deletar plano de teste");
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
        await fetch("/api/planos-de-teste", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...editing, ...form }),
        });
      } else {
        await fetch("/api/planos-de-teste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      fetchPlans();
      limpar();
    } catch {
      setError("Erro ao salvar plano de teste");
    } finally {
      setLoading(false);
    }
  }

  // Kanban CRUD (local state only)
  function limparKanban() {
    setEditingKanban(null);
    setKanbanForm({ titulo: "", status: "backlog" });
  }
  function cancelarKanban() {
    limparKanban();
  }
  function editarKanban(item: KanbanItem) {
    setEditingKanban(item);
    setKanbanForm({ titulo: item.titulo, status: item.status });
  }
  function deletarKanban(id: string) {
    setKanban(kanban => kanban.filter(k => k.id !== id));
    limparKanban();
  }
  function salvarKanban(e: React.FormEvent) {
    e.preventDefault();
    if (editingKanban) {
      setKanban(kanban => kanban.map(k => k.id === editingKanban.id ? { ...k, ...kanbanForm } : k));
    } else {
      setKanban(kanban => [...kanban, { id: Date.now().toString(), ...kanbanForm }]);
    }
    limparKanban();
  }

  // Criar run (apenas exemplo local)
  function criarRun(item: KanbanItem) {
    alert(`Criar run para: ${item.titulo}`);
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Planos de Teste</h1>
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
      <ul className="space-y-2 mb-8">
        {plans.map(plan => (
          <li key={plan.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <div className="font-semibold">{plan.nome}</div>
              <div className="text-sm text-gray-600">{plan.descricao}</div>
            </div>
            <div className="flex gap-2">
              <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={() => editar(plan)} disabled={loading}>
                Editar
              </button>
              <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={() => deletar(plan.id)} disabled={loading}>
                Deletar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <h2 className="text-xl font-bold mb-2">Kanban de Plano de Teste</h2>
      <form className="space-y-2 mb-4" onSubmit={salvarKanban}>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Título do item"
          value={kanbanForm.titulo}
          onChange={e => setKanbanForm(f => ({ ...f, titulo: e.target.value }))}
          required
        />
        <select
          className="w-full border rounded px-3 py-2"
          value={kanbanForm.status}
          onChange={e => setKanbanForm(f => ({ ...f, status: e.target.value as KanbanItem["status"] }))}
          aria-label="Status do item do kanban"
        >
          <option value="backlog">Backlog</option>
          <option value="em progresso">Em Progresso</option>
          <option value="concluido">Concluído</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
            {editingKanban ? "Salvar" : "Adicionar"}
          </button>
          <button type="button" className="bg-gray-400 text-white px-4 py-2 rounded" onClick={cancelarKanban}>
            Cancelar
          </button>
          <button type="button" className="bg-yellow-500 text-white px-4 py-2 rounded" onClick={limparKanban}>
            Limpar
          </button>
        </div>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['backlog', 'em progresso', 'concluido'].map(status => (
          <div key={status} className="bg-gray-100 rounded p-3 min-h-30">
            <div className="font-bold mb-2 capitalize">{status}</div>
            {kanban.filter(k => k.status === status).map(item => (
              <div key={item.id} className="bg-white rounded p-2 mb-2 flex flex-col gap-1 border">
                <div className="font-semibold">{item.titulo}</div>
                <div className="flex gap-2">
                  <button className="bg-green-600 text-white px-2 py-1 rounded text-xs" onClick={() => editarKanban(item)}>
                    Editar
                  </button>
                  <button className="bg-red-600 text-white px-2 py-1 rounded text-xs" onClick={() => deletarKanban(item.id)}>
                    Deletar
                  </button>
                  <button className="bg-blue-600 text-white px-2 py-1 rounded text-xs" onClick={() => criarRun(item)}>
                    Criar Run
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
