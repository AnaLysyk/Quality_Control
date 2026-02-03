"use client";
import { useState } from "react";

export default function CreateCompanyForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) throw new Error("Erro ao criar empresa");
      setName("");
      setSlug("");
      setSuccess(true);
      if (onCreated) onCreated();
    } catch {
      setError("Erro ao criar empresa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 space-y-2">
      <h2 className="text-lg font-bold mb-2">Criar nova empresa</h2>
      <input
        className="border rounded px-2 py-1 w-full"
        placeholder="Nome da empresa"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <input
        className="border rounded px-2 py-1 w-full"
        placeholder="Slug (identificador único)"
        value={slug}
        onChange={e => setSlug(e.target.value)}
        required
      />
      <button
        type="submit"
        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={loading || !name || !slug}
      >
        {loading ? "Salvando..." : "Criar Empresa"}
      </button>
      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">Empresa criada com sucesso!</div>}
    </form>
  );
}
