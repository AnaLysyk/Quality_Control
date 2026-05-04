"use client";
import { useCallback, useEffect, useState } from "react";
import { TcButton, TcCard, TcInput, TcTextarea } from "@/components/theme/TcPrimitives";

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
    <div className="mx-auto max-w-xl p-4 text-text">
      <h2 className="mb-4 text-xl font-bold">Releases Manuais</h2>
      <form onSubmit={handleSubmit} className="mb-6 space-y-2">
        <TcInput
          className="w-full"
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <TcTextarea
          className="w-full"
          placeholder="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TcButton
          type="submit"
          className="px-4 py-2 disabled:opacity-50"
          disabled={loading || !title}
        >
          {loading ? "Salvando..." : "Adicionar Release"}
        </TcButton>
      </form>
      {error && <div className="mb-2 text-sm text-danger">{error}</div>}
      <ul className="space-y-2">
        {releases.map((r) => (
          <li key={r.id} className="list-none">
            <TcCard className="rounded-xl p-3">
              <div className="font-semibold">{r.title ?? "Sem título"}</div>
              <div className="text-sm text-muted">{r.description ?? ""}</div>
              <div className="text-xs text-muted">
                Status: {r.status ?? "N/A"} | Criado em: {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
              </div>
            </TcCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
