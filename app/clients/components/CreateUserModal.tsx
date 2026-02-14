"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; email: string; role: "USER" | "ADMIN" }) => void;
};

export function CreateUserModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      onCreate({ name: name.trim(), email: email.trim(), role });
      setName("");
      setEmail("");
      setRole("USER");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Modal de criação de usuário"
      data-testid="create-user-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl space-y-4"
        aria-label="Criar usuário"
        data-testid="create-user-form"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Criar usuário</h3>
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded px-2 py-1"
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={busy}
            data-testid="close-modal-btn"
          >
            Fechar
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-sm">
            Nome
            <input
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              required
              disabled={busy}
              data-testid="user-name-input"
              aria-label="Nome do usuário"
            />
          </label>
          <label className="block text-sm">
            Email
            <input
              type="email"
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              required
              disabled={busy}
              data-testid="user-email-input"
              aria-label="E-mail do usuário"
            />
          </label>
          <label className="block text-sm">
            Papel
            <select
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
              disabled={busy}
              data-testid="user-role-select"
              aria-label="Papel do usuário"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-200 px-4 py-2 text-sm hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            onClick={onClose}
            disabled={busy}
            data-testid="cancel-btn"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            disabled={busy}
            data-testid="submit-btn"
          >
            {busy ? 'Criando...' : 'Criar usuário'}
          </button>
        </div>
      </form>
    </div>
  );
}
