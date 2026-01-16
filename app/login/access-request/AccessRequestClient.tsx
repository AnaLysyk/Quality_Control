"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const ACCESS_OPTIONS = [
  { value: "user", label: "Usuário da empresa", description: "Acesso regular vinculado a uma empresa/ciente (leitura de dashboards/permissão de execução)." },
  { value: "company", label: "Admin da empresa", description: "Permite gerenciar usuários e releases da própria empresa." },
  { value: "admin", label: "Admin do sistema", description: "Acesso completo ao painel (apenas para equipes internas)." },
];

export default function AccessRequestClient() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [clientId, setClientId] = useState("");
  const [role, setRole] = useState("");
  const [accessType, setAccessType] = useState<"user" | "company" | "admin">("user");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedRole = role.trim();

    if (!normalizedName || !normalizedEmail || !normalizedRole) {
      setError("Informe nome, e-mail e cargo.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError("E-mail inválido.");
      return;
    }

    const normalizedCompany = company.trim();
    const normalizedClientId = clientId.trim();

    if (accessType !== "admin" && !normalizedCompany && !normalizedClientId) {
      setError("Informe o nome da empresa ou o ID do cliente para esse tipo de acesso.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/support/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          company: normalizedCompany,
          client_id: normalizedClientId,
          role: normalizedRole,
          access_type: accessType,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Erro ao registrar solicitação.");
      }

      setSuccess("Solicitação enviada. Em breve você receberá um retorno por e-mail.");
      setName("");
      setEmail("");
      setCompany("");
      setClientId("");
      setRole("");
      setNotes("");
      setAccessType("user");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const currentOption = ACCESS_OPTIONS.find((option) => option.value === accessType);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f4f6fb] via-[#eff0f6] to-[#ffffff] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-8">
        <div>
          <h2 className="text-3xl font-extrabold text-[#0b1a3c] text-center">
            Solicitar acesso
          </h2>
          <p className="mt-2 text-center text-sm text-[#475569]">
            Precisando de acesso a uma empresa ou ao admin? Preencha o formulário e nossa equipe irá aprovar ou orientar o próximo passo.
          </p>
        </div>

        <form className="bg-white shadow-xl rounded-2xl px-8 py-10 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              Nome completo
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="Ana Souza"
              />
            </label>
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              E-mail profissional
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="voce@empresa.com"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm text-[#0b1a3c]">
            Cargo ou função
            <input
              type="text"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              required
              className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
              placeholder="Analista de QA"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              Empresa (ou nome do cliente)
              <input
                type="text"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="Testing Company"
              />
            </label>
            <label className="space-y-1 text-sm text-[#0b1a3c]">
              ID do cliente (opcional)
              <input
                type="text"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
                placeholder="client-123"
              />
            </label>
          </div>

          <div className="space-y-1 text-sm text-[#0b1a3c]">
            <div className="flex items-center justify-between">
              <span>Tipo de acesso</span>
              <span className="text-xs text-[#6b7280]">Escolha conforme seu papel</span>
            </div>
            <select
              value={accessType}
              onChange={(event) => setAccessType(event.target.value as "user" | "company" | "admin")}
              className="w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
            >
              {ACCESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {currentOption && (
              <p className="text-xs text-[#475569]">{currentOption.description}</p>
            )}
          </div>

          <label className="space-y-1 text-sm text-[#0b1a3c]">
            Observações (opcional)
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/30"
              placeholder="Preciso criar releases e revisar dashboards de aceitação."
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center rounded-lg bg-[#011848] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ef0001] hover:text-[#011848] focus:outline-none focus:ring-2 focus:ring-[#ef0001]/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : "Enviar solicitação"}
          </button>

          <div className="text-center text-sm text-[#475569]">
            <Link href="/login" className="font-medium text-[#011848] hover:text-[#ef0001]">
              Voltar ao login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
