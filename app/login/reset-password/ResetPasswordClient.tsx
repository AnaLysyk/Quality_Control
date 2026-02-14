"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("Token de reset inválido ou ausente.");
    }
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError("Token de reset inválido.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      setError(`A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/reset-via-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao redefinir senha");
      }

      setSuccess("Senha redefinida com sucesso! Você será redirecionado para o login.");

      // Redirecionar após 3 segundos
      setTimeout(() => {
        router.push("/login");
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-svh flex items-start sm:items-center justify-start sm:justify-center bg-[--tc-surface] py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden overflow-y-auto">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-[--tc-text]">
              Link Inválido
            </h2>
            <p className="mt-2 text-center text-sm text-[--tc-text-muted]">
              Este link de reset de senha é inválido ou expirou.
            </p>
          </div>
          <div className="text-center">
            <Link
              href="/login/forgot-password"
              className="font-medium text-[--tc-accent] hover:text-[--tc-accent]/80"
            >
              Solicitar novo reset de senha
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh flex items-start sm:items-center justify-start sm:justify-center bg-[--tc-surface] py-12 px-4 sm:px-6 lg:px-8 overflow-x-hidden overflow-y-auto">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[--tc-text]">
            Redefinir Senha
          </h2>
          <p className="mt-2 text-center text-sm text-[--tc-text-muted]">
            Digite sua nova senha
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-xl border border-[--tc-error] bg-[--tc-error-bg] px-4 py-3 text-sm text-[--tc-error-text]">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-[--tc-success] bg-[--tc-success-bg] px-4 py-3 text-sm text-[--tc-success-text]">
              {success}
            </div>
          )}

          <div className="rounded-xl shadow-sm space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-[--tc-text] mb-2">
                Nova Senha
              </label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                className="form-control-user w-full px-4 py-3 border border-[--tc-border] rounded-xl focus:ring-2 focus:ring-[--tc-accent]/40 focus:border-[--tc-accent]/60 transition-all duration-200 bg-[--tc-surface] text-[--tc-text] placeholder:text-[--tc-text-muted] caret-[--tc-accent]"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-[--tc-text] mb-2">
                Confirmar Nova Senha
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="form-control-user w-full px-4 py-3 border border-[--tc-border] rounded-xl focus:ring-2 focus:ring-[--tc-accent]/40 focus:border-[--tc-accent]/60 transition-all duration-200 bg-[--tc-surface] text-[--tc-text] placeholder:text-[--tc-text-muted] caret-[--tc-accent]"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-xl font-semibold text-white bg-linear-to-r from-[--tc-surface] to-[--tc-accent] hover:from-[--tc-surface]/90 hover:to-[--tc-accent]/90 focus:ring-2 focus:ring-[--tc-accent]/60 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Redefinindo..." : "Redefinir Senha"}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="font-medium text-[--tc-accent] hover:text-[--tc-accent]/80"
            >
              Voltar ao login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
