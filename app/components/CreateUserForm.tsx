"use client";
import { useState } from "react";

export default function CreateUserForm({
  onCreated,
  companies,
}: {
  onCreated?: () => void;
  companies: { id: string; name: string }[];
}) {
  const [email, setEmail] = useState("");
  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: login, email, name, password, companyId }),
      });
      if (!res.ok) {
        let msg = "Erro ao criar usuário";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {}
        throw new Error(msg);
      }
      setEmail("");
      setLogin("");
      setName("");
      setPassword("");
      // setCompanyId(companies[0]?.id || ""); // Descomente se quiser resetar empresa
      setSuccess(true);
      if (onCreated) onCreated();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar usuário";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 space-y-2">
      <h2 className="text-lg font-bold mb-2">Criar novo usuário</h2>
      <label className="block">
        <span className="text-sm">E-mail</span>
        <input
          className="form-control-user border rounded px-2 py-1 w-full mt-1"
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          type="email"
          autoComplete="email"
        />
      </label>
      <label className="block">
        <span className="text-sm">Usuário (login)</span>
        <input
          className="form-control-user border rounded px-2 py-1 w-full mt-1"
          placeholder="usuário"
          value={login}
          onChange={e => setLogin(e.target.value)}
          required
          autoComplete="username"
        />
      </label>
      <label className="block">
        <span className="text-sm">Nome</span>
        <input
          className="form-control-user border rounded px-2 py-1 w-full mt-1"
          placeholder="Nome"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </label>
      <label className="block">
        <span className="text-sm">Senha</span>
        <input
          className="form-control-user border rounded px-2 py-1 w-full mt-1"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          type="password"
          autoComplete="new-password"
        />
      </label>
      <label className="block">
        <span className="text-sm">Empresa</span>
        <select
          className="form-control-user border rounded px-2 py-1 w-full mt-1"
          value={companyId}
          onChange={e => setCompanyId(e.target.value)}
          required
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={loading || !email || !login || !name || !password || !companyId}
        role="button"
      >
        {loading ? <span className="animate-pulse">Salvando...</span> : "Criar Usuário"}
      </button>
      {error && (
        <div className="text-red-600" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="text-green-600" role="status">
          Usuário criado com sucesso!
        </div>
      )}
    </form>
  );
}
