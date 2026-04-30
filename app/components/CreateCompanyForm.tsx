"use client";
import { useState } from "react";

type BrasilApiCnpjResponse = {
  razao_social?: string;
  nome_fantasia?: string;
};

function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "").slice(0, 14);
}

export default function CreateCompanyForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleCnpjBlur() {
    const rawCnpj = normalizeCnpj(cnpj);

    if (rawCnpj.length !== 14) return;

    setLoadingCnpj(true);
    setError(null);

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");

      const data = (await res.json()) as BrasilApiCnpjResponse;
      const companyName = (data.nome_fantasia || data.razao_social || "").trim();

      if (companyName && !name.trim()) {
        setName(companyName);
      }
    } catch {
      setError("Não foi possível buscar os dados da empresa pelo CNPJ");
    } finally {
      setLoadingCnpj(false);
    }
  }

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
      setCnpj("");
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
        className="form-control-user border rounded px-2 py-1 w-full"
        placeholder="CNPJ (opcional para preenchimento automático)"
        value={cnpj}
        onChange={e => setCnpj(normalizeCnpj(e.target.value))}
        onBlur={handleCnpjBlur}
      />
      {loadingCnpj && <div className="text-sm text-gray-600">Consultando BrasilAPI...</div>}
      <input
        className="form-control-user border rounded px-2 py-1 w-full"
        placeholder="Nome da empresa"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <input
        className="form-control-user border rounded px-2 py-1 w-full"
        placeholder="Slug (identificador único)"
        value={slug}
        onChange={e => setSlug(e.target.value)}
        required
      />
      <button
        type="submit"
        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={loading || loadingCnpj || !name || !slug}
      >
        {loading ? "Salvando..." : "Criar Empresa"}
      </button>
      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">Empresa criada com sucesso!</div>}
    </form>
  );
}
