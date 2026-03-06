"use client";

import React, { useState } from "react";

export default function CriarAplicacao({ defaultCompany = "test-company" }: { defaultCompany?: string }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [companySlug, setCompanySlug] = useState(defaultCompany);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function genSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!name.trim()) {
      setMessage("Nome é obrigatório");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || genSlug(name), description, companySlug, active }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Erro ao criar aplicação");
      } else {
        setMessage("Aplicação criada com sucesso");
        setName("");
        setSlug("");
        setDescription("");
      }
    } catch (err) {
      setMessage("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card-tc p-4">
      <h3 className="text-lg font-semibold mb-2">Criar Aplicação</h3>
      <form onSubmit={handleCreate} aria-busy={loading}>
        <label className="block mb-2">
          <span className="text-sm">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => !slug && setSlug(genSlug(name))}
            className="input-tc w-full mt-1"
            required
          />
        </label>

        <label className="block mb-2">
          <span className="text-sm">Slug (opcional)</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="input-tc w-full mt-1" />
        </label>

        <label className="block mb-2">
          <span className="text-sm">Descrição</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="textarea-tc w-full mt-1" />
        </label>

        <label className="block mb-2">
          <span className="text-sm">Empresa (companySlug)</span>
          <input value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} className="input-tc w-full mt-1" />
        </label>

        <label className="inline-flex items-center gap-2 mb-4">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span className="text-sm">Ativa</span>
        </label>

        <div className="flex items-center gap-2">
          <button type="submit" className="btn-tc" disabled={loading}>
            {loading ? "Criando..." : "Criar aplicação"}
          </button>
          {message && <span role="status" className="text-sm text-muted">{message}</span>}
        </div>
      </form>
    </div>
  );
}
