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

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onCreate({ name: name.trim(), email: email.trim(), role });
    setName("");
    setEmail("");
    setRole("USER");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Criar usuário</h3>
          <button type="button" className="text-sm text-gray-500" onClick={onClose}>
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
            />
          </label>
          <label className="block text-sm">
            Papel
            <select
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-gray-200 px-4 py-2 text-sm"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
            Criar usuário
          </button>
        </div>
      </form>
    </div>
  );
}
