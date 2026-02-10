"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { readApiError } from "@/lib/apiEnvelope";

type ClientOption = { id: string; name: string };

type Props = {
  open: boolean;
  clientId: string | null;
  clients?: ClientOption[];
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
};

const ROLE_OPTIONS = [
  { value: "client_admin", label: "Admin do cliente" },
  { value: "client_user", label: "Usuario do cliente" },
  { value: "global_admin", label: "Admin global" },
];

export function CreateUserModal({ open, clientId, clients, onClose, onCreated }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("client_user");
  const [jobTitle, setJobTitle] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [localClientId, setLocalClientId] = useState<string | null>(clientId);

  const requiresClient = role !== "global_admin";
  const canSubmit = useMemo(
    () => !!open && (!requiresClient || !!localClientId) && !!name.trim() && !!email.trim(),
    [open, requiresClient, localClientId, name, email],
  );

  useEffect(() => {
    setLocalClientId(clientId);
  }, [clientId]);

  useEffect(() => {
    if (!open) return;
    resetForm();
    setLocalClientId(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  function handleUnauthorized() {
    const msg = "Sessão expirada. Faça login novamente.";
    setError(msg);
    toast.error(msg);
    router.push("/login");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        role,
        client_id: requiresClient ? localClientId : null,
        job_title: jobTitle.trim() || undefined,
        linkedin_url: linkedin.trim() || undefined,
      };

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        const err = await readApiError(res, "Erro ao salvar usuario");
        setError(err.message);
        toast.error(err.displayMessage);
        return;
      }

      const json = (await res.json().catch(() => null)) as { temp_password?: unknown } | null;
      const tempPassword = typeof json?.temp_password === "string" ? json.temp_password : null;
      const okMsg = tempPassword ? `Usuário criado. Senha temporária: ${tempPassword}` : "Usuário criado.";
      setMessage(okMsg);
      toast.success("Usuário criado.");

      try {
        await onCreated?.();
        resetForm();
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao atualizar lista de usuarios";
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar usuario";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setJobTitle("");
    setLinkedin("");
    setAvatarUrl("");
    setRole("client_user");
    setMessage(null);
    setError(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 py-4 overflow-y-auto"
      role="presentation"
    >
      <div className="w-full max-w-4xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase text-indigo-600">Usuario</p>
            <h3 className="text-lg font-semibold text-gray-900">Criar usuario</h3>
            <p className="text-sm text-gray-600">Defina uma senha ou deixe em branco para gerar uma senha temporária.</p>
          </div>
          <button
            type="button"
            className="text-sm text-gray-500"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Fechar
          </button>
        </div>

        {requiresClient && !localClientId && (
          <p className="text-sm text-red-600 mb-3">Selecione uma empresa para criar usuario.</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              Empresa vinculada
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={localClientId ?? ""}
                onChange={(e) => setLocalClientId(e.target.value || null)}
                disabled={role === "global_admin"}
                aria-label="Empresa vinculada ao usuario"
              >
                <option value="">Selecione</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Nome completo
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do usuario"
                required
              />
            </label>

            <label className="block text-sm">
              Email
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                required
              />
            </label>

            <label className="block text-sm">
              Senha (opcional)
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para gerar"
              />
            </label>

            <label className="block text-sm">
              Cargo
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Cargo ou funcao"
              />
            </label>

            <label className="block text-sm">
              Perfil
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={role}
                onChange={(e) => {
                  const next = e.target.value;
                  setRole(next);
                  if (next === "global_admin") setLocalClientId(null);
                }}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              LinkedIn
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://www.linkedin.com/in/usuario"
              />
            </label>

            <label className="block text-sm">
              Foto (URL)
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked readOnly />
              Ativo (ao criar)
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border border-gray-200 px-4 py-2 text-sm"
              onClick={() => {
                resetForm();
                onClose();
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!canSubmit || loading}
            >
              {loading ? "Criando..." : "Criar usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

