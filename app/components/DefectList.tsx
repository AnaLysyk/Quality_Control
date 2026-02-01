"use client";
import { useEffect, useState } from "react";

export default function DefectList({ companyId, releaseManualId }: { companyId: string, releaseManualId?: string }) {
  const [defects, setDefects] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDefects() {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/defect?companyId=${companyId}`;
      if (releaseManualId) url += `&releaseManualId=${releaseManualId}`;
      const res = await fetch(url);
      const data = await res.json();
      setDefects(data);
    } catch (e) {
      setError("Erro ao buscar defeitos");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/defect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, companyId, releaseManualId }),
      });
      if (!res.ok) throw new Error("Erro ao criar defeito");
      setTitle("");
      setDescription("");
      await fetchDefects();
    } catch (e) {
      setError("Erro ao criar defeito");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDefects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, releaseManualId]);

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Defeitos</h2>
      <form onSubmit={handleSubmit} className="mb-6 space-y-2">
        <input
          className="border rounded px-2 py-1 w-full"
          placeholder="Título"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
        />
        <textarea
          className="border rounded px-2 py-1 w-full"
          placeholder="Descrição"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={loading || !title}
        >
          {loading ? "Salvando..." : "Adicionar Defeito"}
        </button>
      </form>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <ul className="space-y-2">
        {defects.map(d => (
          <li key={d.id} className="border rounded p-2">
            <div className="font-semibold">{d.title}</div>
            <div className="text-sm text-gray-600">{d.description}</div>
            <div className="text-xs text-gray-400">Status: {d.status} | Criado em: {new Date(d.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
