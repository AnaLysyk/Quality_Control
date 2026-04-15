"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchApi } from "@/lib/api";

type CompanyUserCreateModalProps = {
  open: boolean;
  companyName: string;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
};

function extractApiError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) return record.error.trim();
  if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
  return null;
}

function suggestUsername(value?: string | null) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");

  return normalized || "usuário";
}

const ROLE_OPTIONS = [
  { value: "company_user", label: "Usuário da empresa" },
  { value: "empresa", label: "Admin da empresa" },
];

export function CompanyUserCreateModal({
  open,
  companyName,
  onClose,
  onCreated,
}: CompanyUserCreateModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("company_user");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameHint = useMemo(
    () => suggestUsername(name.trim() || email.trim() || companyName),
    [companyName, email, name],
  );

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setUsername("");
    setPassword("");
    setRole("user");
    setLoading(false);
    setGenerating(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  async function handleGenerateUsername() {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetchApi("/api/me/username-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: name.trim() || email.trim() || companyName,
          avoid: username.trim() ? [username.trim().toLowerCase()] : [],
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(extractApiError(payload) || "Não foi possível gerar o login.");
        return;
      }
      const nextUsername =
        payload && typeof payload === "object" && typeof (payload as { username?: unknown }).username === "string"
          ? (payload as { username: string }).username.trim().toLowerCase()
          : "";
      if (!nextUsername) {
        setError("Não foi possível gerar o login.");
        return;
      }
      setUsername(nextUsername);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Não foi possível gerar o login.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetchApi("/api/me/company-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          ...(username.trim() ? { username: username.trim().toLowerCase() } : {}),
          password,
          permission_role: role,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(extractApiError(payload) || "Não foi possível criar o usuário.");
        return;
      }

      await onCreated?.();
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Não foi possível criar o usuário.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-3 py-6" role="presentation">
      <div className="my-auto w-full max-w-2xl rounded-[28px] border border-(--tc-border) bg-(--tc-surface) p-5 shadow-[0_24px_60px_rgba(15,23,42,0.28)] sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-(--tc-border) pb-4">
          <div className="space-y-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-(--tc-accent)">Usuários</p>
            <h2 className="text-xl font-semibold text-(--tc-text-primary)">Criar usuário da empresa</h2>
            <p className="text-sm font-medium text-[#0b1f52] dark:text-[#d7e5ff]">
              O usuário nasce com escopo fechado para {companyName}.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-(--tc-border) px-3 py-1.5 text-sm font-semibold text-(--tc-text-primary) transition hover:bg-(--tc-surface-2)"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2.5 text-sm text-(--tc-text-primary) md:col-span-2">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent)">Nome</span>
              <input
                className="h-14 w-full rounded-xl border border-slate-500 bg-[#f5f7fb] px-4 text-base font-semibold text-[#0b1f52] shadow-[0_3px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:text-[#4b6697] hover:border-[#0b1f52] focus:border-(--tc-accent) focus:bg-white focus:ring-2 focus:ring-(--tc-accent)/26 dark:border-slate-400 dark:bg-[#13213a] dark:text-[#d7e5ff] dark:placeholder:text-[#b4cbff] dark:hover:border-[#d7e5ff] dark:focus:border-(--tc-accent) dark:focus:bg-[#182742]"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Flavio Silva"
                required
              />
            </label>

            <label className="flex flex-col gap-2.5 text-sm text-(--tc-text-primary)">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent)">Usuário</span>
              <input
                className="h-14 w-full rounded-xl border border-slate-500 bg-[#f5f7fb] px-4 text-base font-semibold text-[#0b1f52] shadow-[0_3px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:text-[#4b6697] hover:border-[#0b1f52] focus:border-(--tc-accent) focus:bg-white focus:ring-2 focus:ring-(--tc-accent)/26 dark:border-slate-400 dark:bg-[#13213a] dark:text-[#d7e5ff] dark:placeholder:text-[#b4cbff] dark:hover:border-[#d7e5ff] dark:focus:border-(--tc-accent) dark:focus:bg-[#182742]"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={`Ex.: ${usernameHint}`}
              />
              <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-(--tc-accent)">
                <span>Único no sistema. Em branco, gera automaticamente.</span>
                <button
                  type="button"
                  className="rounded-full border border-[#0b1f52] bg-[#0b1f52] px-3 py-1 text-white transition hover:border-(--tc-accent) hover:bg-(--tc-accent) disabled:opacity-60"
                  onClick={() => void handleGenerateUsername()}
                  disabled={loading || generating}
                >
                  {generating ? "Gerando..." : "Gerar login"}
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-2.5 text-sm text-(--tc-text-primary)">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent)">Perfil</span>
              <select
                className="h-14 w-full rounded-xl border border-slate-500 bg-[#f5f7fb] px-4 py-3 text-sm font-semibold text-[#0b1f52] shadow-[0_3px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition hover:border-[#0b1f52] focus:border-(--tc-accent) focus:bg-white focus:ring-2 focus:ring-(--tc-accent)/26 dark:border-slate-400 dark:bg-[#13213a] dark:text-[#d7e5ff] dark:hover:border-[#d7e5ff] dark:focus:border-(--tc-accent) dark:focus:bg-[#182742]"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2.5 text-sm text-(--tc-text-primary)">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent)">E-mail</span>
              <input
                type="email"
                className="h-14 w-full rounded-xl border border-slate-500 bg-[#f5f7fb] px-4 text-base font-semibold text-[#0b1f52] shadow-[0_3px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:text-[#4b6697] hover:border-[#0b1f52] focus:border-(--tc-accent) focus:bg-white focus:ring-2 focus:ring-(--tc-accent)/26 dark:border-slate-400 dark:bg-[#13213a] dark:text-[#d7e5ff] dark:placeholder:text-[#b4cbff] dark:hover:border-[#d7e5ff] dark:focus:border-(--tc-accent) dark:focus:bg-[#182742]"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuário@empresa.com"
                required
              />
            </label>

            <label className="flex flex-col gap-2.5 text-sm text-(--tc-text-primary)">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-(--tc-accent)">Senha</span>
              <input
                type="password"
                minLength={8}
                className="h-14 w-full rounded-xl border border-slate-500 bg-[#f5f7fb] px-4 text-base font-semibold text-[#0b1f52] shadow-[0_3px_10px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] outline-none transition placeholder:text-[#4b6697] hover:border-[#0b1f52] focus:border-(--tc-accent) focus:bg-white focus:ring-2 focus:ring-(--tc-accent)/26 dark:border-slate-400 dark:bg-[#13213a] dark:text-[#d7e5ff] dark:placeholder:text-[#b4cbff] dark:hover:border-[#d7e5ff] dark:focus:border-(--tc-accent) dark:focus:bg-[#182742]"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
              />
            </label>
          </div>

          {error ? (
            <div className="rounded-[18px] border-2 border-rose-500 bg-rose-100/95 px-4 py-3 text-sm font-semibold text-rose-950 shadow-[0_10px_28px_rgba(190,24,93,0.16)] dark:border-rose-300 dark:bg-rose-950/72 dark:text-rose-50">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-(--tc-border) pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-(--tc-border) px-4 text-sm font-semibold text-(--tc-text-primary) transition hover:bg-(--tc-surface-2)"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-linear-to-b from-(--tc-accent,#ff4b4b) to-(--tc-accent-dark,#c30000) px-5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Criando..." : "Criar usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
