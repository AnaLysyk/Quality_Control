"use client";
import { useCallback, useEffect, useState } from "react";
import { TcButton, TcCard, TcInput, TcTextarea } from "@/components/theme/TcPrimitives";

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
    <div className="mx-auto max-w-xl p-4 text-text">
      <h2 className="mb-4 text-xl font-bold">Defeitos</h2>
      <form onSubmit={handleSubmit} className="mb-6 space-y-2">
        <TcInput
          className="w-full"
          placeholder="Titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <TcTextarea
          className="w-full"
          placeholder="Descricao"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TcButton
          type="submit"
          className="px-4 py-2 disabled:opacity-50"
          disabled={loading || !title}
        >
          {loading ? "Salvando..." : "Adicionar Defeito"}
        </TcButton>
      </form>
      {error && <div className="mb-2 text-sm text-danger">{error}</div>}
      <ul className="space-y-2">
        {defects.map((d) => (
          <li key={d.id} className="list-none">
            <TcCard className="rounded-xl p-3">
              <div className="font-semibold">{d.title ?? "Sem titulo"}</div>
              <div className="text-sm text-muted">{d.description ?? ""}</div>
              <div className="text-xs text-muted">
                Status: {d.status ?? "N/A"} | Criado em: {d.createdAt ? new Date(d.createdAt).toLocaleString() : "-"}
              </div>
            </TcCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
