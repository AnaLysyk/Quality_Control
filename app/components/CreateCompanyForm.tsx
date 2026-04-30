"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { extractCnpjCompanyName, lookupCnpjCompany, normalizeCnpj } from "@/lib/brasilApiCnpj";

export default function CreateCompanyForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const cnpjLookupIdRef = useRef(0);
  const cnpjLookupControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cnpjLookupControllerRef.current?.abort();
    };
  }, []);

  async function handleCnpjBlur() {
    const rawCnpj = normalizeCnpj(cnpj);

    if (rawCnpj.length !== 14) return;

    const lookupId = ++cnpjLookupIdRef.current;
    cnpjLookupControllerRef.current?.abort();
    const controller = new AbortController();
    cnpjLookupControllerRef.current = controller;

    setLoadingCnpj(true);
    setError(null);

    try {
      const data = await lookupCnpjCompany(rawCnpj, controller.signal);
      const companyName = extractCnpjCompanyName(data);

      if (!isMountedRef.current || lookupId !== cnpjLookupIdRef.current) return;

      if (companyName) {
        setName((currentName) => (currentName.trim() ? currentName : companyName));
      }
    } catch (error) {
      if (!isMountedRef.current || lookupId !== cnpjLookupIdRef.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError(error instanceof Error ? error.message : "Nao foi possivel consultar o CNPJ");
    } finally {
      if (isMountedRef.current && lookupId === cnpjLookupIdRef.current) {
        setLoadingCnpj(false);
        if (cnpjLookupControllerRef.current === controller) {
          cnpjLookupControllerRef.current = null;
        }
      }
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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
        onChange={(e) => setCnpj(normalizeCnpj(e.target.value))}
        onBlur={handleCnpjBlur}
        inputMode="numeric"
      />
      {loadingCnpj && <div className="text-sm text-gray-600">Consultando BrasilAPI...</div>}
      <input
        className="form-control-user border rounded px-2 py-1 w-full"
        placeholder="Nome da empresa"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className="form-control-user border rounded px-2 py-1 w-full"
        placeholder="Slug (identificador único)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
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
