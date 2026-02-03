"use client";
import { useCallback, useEffect, useState } from "react";

type ManualRelease = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

export default function ReleaseManualList({ companyId }: { companyId: string }) {
  const [releases, setReleases] = useState<ManualRelease[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/release-manual?companyId=${companyId}`);
      const data = (await res.json()) as ManualRelease[];
      setReleases(Array.isArray(data) ? data : []);
    } catch {
      setError("Erro ao buscar releases");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/release-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, companyId }),
      });
      if (!res.ok) throw new Error("Erro ao criar release");
      setTitle("");
      setDescription("");
      await fetchReleases();
    } catch {
      setError("Erro ao criar release");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Releases Manuais</h2>
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
          {loading ? "Salvando..." : "Adicionar Release"}
        </button>
      </form>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <ul className="space-y-2">
        {releases.map((r) => (
          <li key={r.id} className="border rounded p-2">
            <div className="font-semibold">{r.title ?? "Sem titulo"}</div>
            <div className="text-sm text-gray-600">{r.description ?? ""}</div>
            <div className="text-xs text-gray-400">
              Status: {r.status ?? "N/A"} | Criado em: {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
