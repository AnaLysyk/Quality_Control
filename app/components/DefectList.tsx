"use client";
import { useCallback, useEffect, useState } from "react";

type Defect = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export default function DefectList({ companyId, releaseManualId }: { companyId: string; releaseManualId?: string }) {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDefects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/defect?companyId=${companyId}`;
      if (releaseManualId) url += `&releaseManualId=${releaseManualId}`;
      const res = await fetch(url);
      const data = (await res.json()) as Defect[];
      setDefects(Array.isArray(data) ? data : []);
    } catch {
      setError("Erro ao buscar defeitos");
    } finally {
      setLoading(false);
    }
  }, [companyId, releaseManualId]);

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
    } catch {
      setError("Erro ao criar defeito");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDefects();
  }, [fetchDefects]);

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Defeitos</h2>
      <form onSubmit={handleSubmit} className="mb-6 space-y-2">
        <input
          className="border rounded px-2 py-1 w-full"
          placeholder="Titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="border rounded px-2 py-1 w-full"
          placeholder="Descricao"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
        {defects.map((d) => (
          <li key={d.id} className="border rounded p-2">
            <div className="font-semibold">{d.title ?? "Sem titulo"}</div>
            <div className="text-sm text-gray-600">{d.description ?? ""}</div>
            <div className="text-xs text-gray-400">
              Status: {d.status ?? "N/A"} | Criado em: {d.createdAt ? new Date(d.createdAt).toLocaleString() : "-"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
