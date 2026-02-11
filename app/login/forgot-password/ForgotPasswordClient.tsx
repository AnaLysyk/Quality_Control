"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import loginStyles from "../LoginClient.module.css";
import styles from "./ForgotPasswordClient.module.css";

export default function ForgotPasswordClient() {
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedLogin = login.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedLogin || !normalizedEmail) {
      setError("Informe seu usuário e e-mail.");
      return;
    }

    // Validação básica de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError("E-mail inválido.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user: normalizedLogin, email: normalizedEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao solicitar reset");
      }
      setSuccess(
        "Solicitação enviada. Um administrador vai revisar o pedido e, se aprovado, você receberá as instruções por e-mail."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={
        `${loginStyles.loginContainer} ${loginStyles.loginFixedTheme} min-h-svh flex items-start sm:items-center ` +
        "justify-start sm:justify-center bg-linear-to-br from-[#011848] via-[#f4f6fb] to-[#ef0001] " +
        "relative overflow-x-hidden overflow-y-auto px-4 py-10 sm:px-6 md:px-10"
      }
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-6 left-6 w-32 h-32 bg-[#011848] rounded-full opacity-20 blur-2xl animate-ping"></div>
        <div className="absolute bottom-6 right-6 w-28 h-28 bg-[#ef0001] rounded-full opacity-20 blur-2xl animate-pulse"></div>
        <div className="absolute top-1/6 right-1/5 w-20 h-20 bg-[#ef0001] rounded-full opacity-10 blur-lg animate-bounce delay-1000"></div>
        <div className="absolute bottom-1/6 left-1/5 w-24 h-24 bg-[#011848] rounded-full opacity-10 blur-lg animate-pulse delay-700"></div>
        <div className="absolute top-10 left-44 w-16 h-16 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-500"></div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-20 bg-[#011848] rounded-full opacity-10 blur animate-bounce delay-200"></div>
        <div className="absolute top-1/2 left-2 w-14 h-14 bg-[#ef0001] rounded-full opacity-10 blur animate-pulse delay-800"></div>
        <div className="absolute top-1/2 right-2 w-14 h-14 bg-[#011848] rounded-full opacity-10 blur animate-ping delay-600"></div>
      </div>

      <div className="max-w-lg w-full space-y-8 relative z-10 sm:max-w-xl md:max-w-2xl">
        <div className={`text-center ${styles.introBase} ${styles.introDelay1}`}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#011848]/10 bg-white/70 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#011848]/70">
            Recuperação
          </span>
          <h2 className="mt-5 text-3xl sm:text-4xl font-bold text-[#011848] mb-2 leading-tight drop-shadow-sm">
            Esqueceu sua senha?
          </h2>
          <p className="text-[#0b1a3c] font-medium">
            Digite seu usuário e e-mail para solicitar a redefinição de senha.
          </p>
        </div>

        <form
          className={`bg-white/90 backdrop-blur-sm p-5 sm:p-8 rounded-2xl shadow-2xl border border-[#011848]/10 w-full max-w-sm sm:max-w-md mx-auto min-w-0 ${
            styles.introBase
          } ${styles.introDelay2}`}
          onSubmit={onSubmit}
        >
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 leading-relaxed">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="login" className="block text-sm font-semibold text-[#011848] mb-2">
                Usuário
              </label>
              <input
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                required
                className="form-control-user w-full px-4 py-3 border border-[#011848]/15 rounded-xl focus:ring-2 focus:ring-[#ef0001]/40 focus:border-[#ef0001]/60 transition-all duration-200 bg-white text-[#011848] placeholder:text-[#9aa3b2] caret-[#ef0001]"
                placeholder="Seu usuário"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#011848] mb-2">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="form-control-user w-full px-4 py-3 border border-[#011848]/15 rounded-xl focus:ring-2 focus:ring-[#ef0001]/40 focus:border-[#ef0001]/60 transition-all duration-200 bg-white text-[#011848] placeholder:text-[#9aa3b2] caret-[#ef0001]"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-linear-to-r from-[#011848] to-[#ef0001] text-white py-3 px-4 rounded-xl font-semibold hover:from-[#011848]/90 hover:to-[#ef0001]/90 focus:ring-2 focus:ring-[#ef0001]/60 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : "Enviar instruções"}
          </button>

          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="font-semibold text-[#011848]/80 hover:text-[#011848]">
              Voltar ao login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
